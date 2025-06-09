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
	"io"
	"net"
	"net/netip"
	"sync"
	"sync/atomic"
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
// If `defaultListener` is nil, which
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
	isClosed atomic.Bool

	defaultListener transport.PacketListener

	listenerTable IPTable[transport.PacketListener]
	connMap       map[transport.PacketListener]net.PacketConn
	connMapLock   sync.Mutex

	forwardingContext            context.Context
	closePacketForwardingContext context.CancelFunc
	forwardedPackets             chan incomingPacket
	forwardCounter               sync.WaitGroup

	deadline      time.Time
	readDeadline  time.Time
	writeDeadline time.Time
}

var _ net.PacketConn = (*packetConn)(nil)

const (
	defaultMTU      = 1500
	packetQueueSize = 128
)

var packetBufferPool = sync.Pool{
	New: func() interface{} {
		return make([]byte, defaultMTU)
	},
}

func newPacketConn(
	parentContext context.Context,
	listenerTable IPTable[transport.PacketListener],
	defaultListener transport.PacketListener,
) (*packetConn, error) {
	ctx, cancel := context.WithCancel(parentContext)

	conn := &packetConn{
		isClosed:                     atomic.Bool{},
		forwardedPackets:             make(chan incomingPacket, packetQueueSize),
		forwardingContext:            ctx,
		closePacketForwardingContext: cancel,
		connMap:                      make(map[transport.PacketListener]net.PacketConn),
		connMapLock:                  sync.Mutex{},
		listenerTable:                listenerTable,
		defaultListener:              defaultListener,
		deadline:                     time.Time{},
		readDeadline:                 time.Time{},
		writeDeadline:                time.Time{},
	}

	if conn.defaultListener != nil {
		connAttempt, err := defaultListener.ListenPacket(ctx)

		if err == nil {
			conn.connMap[defaultListener] = connAttempt
			conn.forwardPackets(connAttempt)
		}
	}

	return conn, nil
}

func (conn *packetConn) ReadFrom(result []byte) (n int, addr net.Addr, err error) {
	if conn.isClosed.Load() {
		return 0, nil, net.ErrClosed
	}

	packet, ok := <-conn.forwardedPackets
	if !ok {
		return 0, nil, net.ErrClosed
	}

	// Copy what fits and discard the rest according to UDP standard:
	n = copy(result, packet.data)

	if len(packet.data) > len(result) {
		return n, packet.addr, io.ErrShortBuffer
	}

	return n, packet.addr, nil
}

func (conn *packetConn) WriteTo(packet []byte, addr net.Addr) (numBytes int, err error) {
	if conn.isClosed.Load() {
		return 0, net.ErrClosed
	}

	host, _, err := net.SplitHostPort(addr.String())

	var ip netip.Addr
	// SplitHostPort returns an err if the addr is not in the 0.0.0.0:0 format:
	if err != nil {
		if udpAddr, ok := addr.(*net.UDPAddr); ok {
			if parsedIP, ok := netip.AddrFromSlice(udpAddr.IP); ok {
				ip = parsedIP
				err = nil
			}
		}
	} else {
		ip, err = netip.ParseAddr(host)
	}

	if !ip.IsValid() || err != nil {
		return 0, fmt.Errorf("could not parse valid IP from address %v (%T)", addr, addr)
	}

	ip = ip.Unmap()
	listener, _ := conn.listenerTable.Lookup(ip)

	conn.connMapLock.Lock()
	subconn := conn.connMap[listener]
	conn.connMapLock.Unlock()

	if listener != nil && subconn == nil {
		subconn, err = listener.ListenPacket(conn.forwardingContext)

		if err != nil {
			return 0, err
		}

		subconn.SetDeadline(conn.deadline)
		subconn.SetReadDeadline(conn.readDeadline)
		subconn.SetWriteDeadline(conn.writeDeadline)

		conn.connMapLock.Lock()
		if conn.connMap[listener] != nil {
			// Another connection was created while we were creating this connection:
			subconn.Close()
		} else {
			conn.connMap[listener] = subconn
		}
		conn.connMapLock.Unlock()

		conn.forwardPackets(subconn)
	} else {
		return 0, fmt.Errorf("no connection found for IP %s", ip.String())
	}

	return subconn.WriteTo(packet, addr)
}

func (conn *packetConn) Close() error {
	var errs error
	conn.closePacketForwardingContext()

	conn.isClosed.Store(true)

	conn.connMapLock.Lock()
	for address, subconn := range conn.connMap {
		if err := subconn.Close(); err != nil {
			errs = errors.Join(errs, fmt.Errorf("failed to close subconnection for %s: %w", address, err))
		}
	}
	clear(conn.connMap)
	conn.connMap = nil
	conn.connMapLock.Unlock()

	conn.forwardCounter.Wait()
	close(conn.forwardedPackets)

	return errs
}

// Return the default connection local addr, then the first available subconnection if no default
func (conn *packetConn) LocalAddr() net.Addr {
	conn.connMapLock.Lock()
	for _, subconn := range conn.connMap {
		if localAddr := subconn.LocalAddr(); localAddr != nil {
			return localAddr
		}
	}
	conn.connMapLock.Unlock()

	return nil
}

func (conn *packetConn) SetDeadline(t time.Time) error {
	conn.deadline = t

	conn.connMapLock.Lock()
	for _, subconnection := range conn.connMap {
		subconnection.SetDeadline(t)
	}
	conn.connMapLock.Unlock()

	return nil
}

func (conn *packetConn) SetReadDeadline(t time.Time) error {
	conn.readDeadline = t

	conn.connMapLock.Lock()
	for _, subconnection := range conn.connMap {
		subconnection.SetReadDeadline(t)
	}
	conn.connMapLock.Unlock()

	return nil
}

func (conn *packetConn) SetWriteDeadline(t time.Time) error {
	conn.writeDeadline = t

	conn.connMapLock.Lock()
	for _, subconnection := range conn.connMap {
		subconnection.SetWriteDeadline(t)
	}
	conn.connMapLock.Unlock()

	return nil
}

func (conn *packetConn) forwardPackets(subconnection net.PacketConn) {
	conn.forwardCounter.Add(1)
	go func() {
		readBuffer := packetBufferPool.Get().([]byte)
		defer packetBufferPool.Put(&readBuffer)
		defer conn.forwardCounter.Done()

		for {
			numBytes, remoteAddr, err := subconnection.ReadFrom(readBuffer)
			if err != nil || conn.isClosed.Load() {
				return
			}

			conn.forwardedPackets <- incomingPacket{data: readBuffer[:numBytes], addr: remoteAddr}
		}
	}()
}
