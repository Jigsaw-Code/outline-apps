// Copyright 2025 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package iptable

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"sync"
	"time"

	"github.com/Jigsaw-Code/outline-sdk/transport"
)

// PacketListener is a [transport.PacketListener] that multiplexes packet handling
// based on the remote IP address using an [IPTable].
//
// When [PacketListener.ListenPacket] is called, it returns a [net.PacketConn]
// that manages multiple underlying packet connections.
// For outgoing packets (via net.PacketConn.WriteTo), the destination IP address is
// looked up in the table. If a specific listener is found, a connection is established
// using that listener (if not already done) and the packet is sent. Otherwise, the
// default listener is used.
// For incoming packets (via net.PacketConn.ReadFrom), packets from all managed
// underlying connections (both specific and default) are aggregated and returned.
type PacketListener struct {
	table           IPTable[transport.PacketListener]
	defaultListener transport.PacketListener
}

var _ transport.PacketListener = (*PacketListener)(nil)

func NewPacketListener(table IPTable[transport.PacketListener], defaultListener transport.PacketListener) (*PacketListener, error) {
	if table == nil {
		table = NewIPTable[transport.PacketListener]()
	}

	return &PacketListener{
		table:           table,
		defaultListener: defaultListener,
	}, nil
}

// SetDefault sets the [transport.PacketListener] to be used for IP addresses that
// do not match any specific rule in the IP table.
// Unlike the constructor, this method allows `defaultListener` to be nil, which
// would mean no packets can be sent or received for addresses not in the table.
func (listener *PacketListener) SetDefault(defaultListener transport.PacketListener) {
	listener.defaultListener = defaultListener
}

// ListenPacket returns a [net.PacketConn] that routes packets based on IP addresses.
// The returned connection aggregates packets from and dispatches packets to various
// underlying listeners as defined by the IP table and the default listener.
func (listener *PacketListener) ListenPacket(ctx context.Context) (net.PacketConn, error) {
	return newPacketConn(ctx, listener.table, listener.defaultListener)
}

const packetQueueSize = 128

type incomingPacket struct {
	data []byte
	addr net.Addr
}

// packetConn is a [net.PacketConn] implementation that multiplexes
// packets over various underlying [net.PacketConn]s based on IP addresses.
// It is returned by [PacketListener.ListenPacket].
//
// For outgoing packets (WriteTo), it determines the appropriate underlying
// connection using an [IPTable] and a default listener. New underlying
// connections are established on-demand.
// For incoming packets (ReadFrom), it aggregates packets received from all
// active underlying connections (both specific and default) into a single channel.
type packetConn struct {
	defaultListener transport.PacketListener
	defaultConn     net.PacketConn

	listenerTable IPTable[transport.PacketListener]
	connMap       map[netip.Addr]net.PacketConn
	connMapLock   sync.Mutex

	forwardingContext            context.Context
	closePacketForwardingContext context.CancelFunc
	forwardedPackets             chan incomingPacket
	forwardCounter               sync.WaitGroup

	lastRemainingPacket     incomingPacket
	lastRemainingPacketLock sync.Mutex
}

var _ net.PacketConn = (*packetConn)(nil)

func newPacketConn(
	parentContext context.Context,
	listenerTable IPTable[transport.PacketListener],
	defaultListener transport.PacketListener,
) (*packetConn, error) {
	forwardingContext, closeForwardingContext := context.WithCancel(parentContext)

	var defaultConn net.PacketConn
	if defaultListener != nil {
		connAttempt, err := defaultListener.ListenPacket(forwardingContext)

		if err != nil {
			defaultConn = nil
		} else {
			defaultConn = connAttempt
		}
	}

	conn := &packetConn{
		closePacketForwardingContext: closeForwardingContext,
		connMap:                      make(map[netip.Addr]net.PacketConn),
		connMapLock:                  sync.Mutex{},
		defaultConn:                  defaultConn,
		defaultListener:              defaultListener,
		forwardedPackets:             make(chan incomingPacket, packetQueueSize),
		forwardingContext:            forwardingContext,
		listenerTable:                listenerTable,
		lastRemainingPacket:          incomingPacket{},
		lastRemainingPacketLock:      sync.Mutex{},
	}

	if conn.defaultConn != nil {
		conn.forwardPackets(conn.defaultConn)
	}

	return conn, nil
}

func (conn *packetConn) ReadFrom(result []byte) (n int, addr net.Addr, err error) {
	if len(conn.lastRemainingPacket.data) > 0 {
		conn.lastRemainingPacketLock.Lock()
		numBytes := copy(result, conn.lastRemainingPacket.data)
		conn.lastRemainingPacket.data = conn.lastRemainingPacket.data[numBytes:]
		conn.lastRemainingPacketLock.Unlock()

		return numBytes, conn.lastRemainingPacket.addr, nil
	}

	packet, ok := <-conn.forwardedPackets
	if !ok {
		return 0, nil, net.ErrClosed
	}

	numBytes := copy(result, packet.data)

	conn.lastRemainingPacketLock.Lock()
	conn.lastRemainingPacket.data = packet.data[numBytes:]
	conn.lastRemainingPacket.addr = packet.addr
	conn.lastRemainingPacketLock.Unlock()

	return numBytes, packet.addr, nil
}

func (conn *packetConn) WriteTo(packet []byte, addr net.Addr) (numBytes int, err error) {
	var ip netip.Addr
	if udpAddr, ok := addr.(*net.UDPAddr); ok {
		if parsedIP, ok := netip.AddrFromSlice(udpAddr.IP); ok {
			ip = parsedIP
		}
	}
	if !ip.IsValid() {
		return 0, fmt.Errorf("could not parse valid IP from address %v (%T)", addr, addr)
	}

	ip = ip.Unmap()

	conn.connMapLock.Lock()
	subconn := conn.connMap[ip]
	conn.connMapLock.Unlock()

	if subconn == nil {
		listener, ok := conn.listenerTable.Lookup(ip)

		if ok {
			subconn, err = listener.ListenPacket(conn.forwardingContext)

			if err != nil {
				return 0, err
			}

			conn.connMapLock.Lock()
			conn.connMap[ip] = subconn
			conn.connMapLock.Unlock()

			conn.forwardPackets(subconn)
		}
	}

	if subconn == nil && conn.defaultListener != nil {
		subconn = conn.defaultConn
	} else if subconn == nil {
		return 0, fmt.Errorf("no connection found for IP %s", ip.String())
	}

	return subconn.WriteTo(packet, addr)
}

func (conn *packetConn) Close() error {
	var errs error
	conn.closePacketForwardingContext()

	conn.connMapLock.Lock()
	for address, subconn := range conn.connMap {
		if err := subconn.Close(); err != nil {
			errs = errors.Join(errs, fmt.Errorf("failed to close subconnection for %s: %w", address, err))
		}
		delete(conn.connMap, address)
	}
	conn.connMapLock.Unlock()

	if conn.defaultConn != nil {
		if err := conn.defaultConn.Close(); err != nil {
			errs = errors.Join(errs, fmt.Errorf("failed to close default connection: %w", err))
		}
	}

	conn.forwardCounter.Wait()
	close(conn.forwardedPackets)

	return errs
}

// Return the default connection local addr, then the first available subconnection if no default
func (conn *packetConn) LocalAddr() net.Addr {
	if localAddr := conn.defaultConn.LocalAddr(); localAddr != nil {
		return localAddr
	}

	conn.connMapLock.Lock()
	defer conn.connMapLock.Unlock()
	for _, subconn := range conn.connMap {
		if localAddr := subconn.LocalAddr(); localAddr != nil {
			return localAddr
		}
	}

	return nil
}

func (conn *packetConn) SetDeadline(t time.Time) error {
	if conn.defaultConn != nil {
		conn.defaultConn.SetDeadline(t)
	}

	conn.connMapLock.Lock()
	defer conn.connMapLock.Unlock()

	for _, subconnection := range conn.connMap {
		subconnection.SetDeadline(t)
	}

	return nil
}

func (conn *packetConn) SetReadDeadline(t time.Time) error {
	if conn.defaultConn != nil {
		conn.defaultConn.SetReadDeadline(t)
	}

	conn.connMapLock.Lock()
	defer conn.connMapLock.Unlock()

	for _, subconnection := range conn.connMap {
		subconnection.SetReadDeadline(t)
	}

	return nil
}

func (conn *packetConn) SetWriteDeadline(t time.Time) error {
	if conn.defaultConn != nil {
		conn.defaultConn.SetWriteDeadline(t)
	}

	conn.connMapLock.Lock()
	defer conn.connMapLock.Unlock()

	for _, subconnection := range conn.connMap {
		subconnection.SetWriteDeadline(t)
	}

	return nil
}

func (conn *packetConn) forwardPackets(subconnection net.PacketConn) {
	conn.forwardCounter.Add(1)
	go func() {
		defer conn.forwardCounter.Done()
		readBuffer := make([]byte, 65536) // Max UDP packet size
		for {
			numBytes, remoteAddr, err := subconnection.ReadFrom(readBuffer)
			if err != nil {
				return
			}

			packet := make([]byte, numBytes)
			copy(packet, readBuffer[:numBytes])

			conn.forwardedPackets <- incomingPacket{data: packet, addr: remoteAddr}
		}
	}()
}
