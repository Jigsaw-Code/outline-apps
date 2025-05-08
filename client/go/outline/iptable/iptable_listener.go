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

// TODO: document
type IPTablePacketListener struct {
	table           IPTable[transport.PacketListener]
	defaultListener transport.PacketListener
}

var _ transport.PacketListener = (*IPTablePacketListener)(nil)

// TODO: document
func NewIPTablePacketListener(table IPTable[transport.PacketListener], defaultListener transport.PacketListener) (*IPTablePacketListener, error) {
	if defaultListener == nil {
		return nil, errors.New("IPTablePacketListener requires a non-nil defaultListener")
	}
	if table == nil {
		table = NewIPTable[transport.PacketListener]()
	}

	return &IPTablePacketListener{
		table:           table,
		defaultListener: defaultListener,
	}, nil
}

// TODO: document
func (listener *IPTablePacketListener) SetDefault(defaultListener transport.PacketListener) {
	listener.defaultListener = defaultListener
}

// TODO: document
func (listener *IPTablePacketListener) ListenPacket(ctx context.Context) (net.PacketConn, error) {
	return newIPTableConnection(ctx, listener.table, listener.defaultListener)
}

const packetQueueSize = 128 // what should this be?

type incomingPacket struct {
	data []byte
	addr net.Addr
}

// TODO: probably document this for clarity, even though it's not exported
type ipTableConnection struct {
	defaultListener   transport.PacketListener
	defaultConnection net.PacketConn

	listenerTable       IPTable[transport.PacketListener]
	connectionMap       map[netip.Addr]net.PacketConn
	connectionMapThread sync.Mutex

	forwardingContext      context.Context
	closeForwardingContext context.CancelFunc
	forwardedPackets       chan incomingPacket
	forwardCounter         sync.WaitGroup
}

var _ net.PacketConn = (*ipTableConnection)(nil)

func newIPTableConnection(
	parentContext context.Context,
	listenerTable IPTable[transport.PacketListener],
	defaultListener transport.PacketListener,
) (*ipTableConnection, error) {
	forwardingContext, closeForwardingContext := context.WithCancel(parentContext)

	var defaultConnection net.PacketConn
	if defaultListener != nil {
		connectionAttempt, err := defaultListener.ListenPacket(forwardingContext)

		if err != nil {
			defaultConnection = nil
		} else {
			defaultConnection = connectionAttempt
		}
	}

	connection := &ipTableConnection{
		closeForwardingContext: closeForwardingContext,
		connectionMap:          make(map[netip.Addr]net.PacketConn),
		connectionMapThread:    sync.Mutex{},
		defaultConnection:      defaultConnection,
		defaultListener:        defaultListener,
		forwardedPackets:       make(chan incomingPacket, packetQueueSize),
		forwardingContext:      forwardingContext,
		listenerTable:          listenerTable,
	}

	if connection.defaultConnection != nil {
		connection.forwardCounter.Add(1)
		go connection.forwardPackets(connection.defaultConnection)
	}

	return connection, nil
}

func (connection *ipTableConnection) ReadFrom(result []byte) (n int, addr net.Addr, err error) {
	packet, ok := <-connection.forwardedPackets
	if !ok {
		return 0, nil, net.ErrClosed
	}

	var bufferError error
	if len(result) < len(packet.data) {
		bufferError = fmt.Errorf("buffer too small for packet data (%d vs %d)", len(result), len(packet.data))
	}

	numBytes := copy(result, packet.data)
	return numBytes, packet.addr, bufferError
}

func (connection *ipTableConnection) WriteTo(packet []byte, addr net.Addr) (numBytes int, err error) {
	// TODO: make this safer
	ip := netip.MustParseAddr(addr.String())

	connection.connectionMapThread.Lock()
	defer connection.connectionMapThread.Unlock()

	subconnection := connection.connectionMap[ip]

	if subconnection == nil {
		listener, ok := connection.listenerTable.Lookup(ip)

		if !ok {
			listener = connection.defaultListener
		}

		if listener == nil {
			return 0, fmt.Errorf("no listener found for %s", ip.String())
		}

		subconnection, err = listener.ListenPacket(connection.forwardingContext)

		if err != nil {
			return 0, err
		}

		connection.connectionMap[ip] = subconnection

		connection.forwardCounter.Add(1)
		go connection.forwardPackets(subconnection)
	}

	return subconnection.WriteTo(packet, addr)
}

func (connection *ipTableConnection) Close() error {
	connection.closeForwardingContext()

	connection.connectionMapThread.Lock()
	defer connection.connectionMapThread.Unlock()

	for address, subconnection := range connection.connectionMap {
		subconnection.Close()
		delete(connection.connectionMap, address)
	}

	if connection.defaultConnection != nil {
		connection.defaultConnection.Close()
	}

	connection.forwardCounter.Wait()
	close(connection.forwardedPackets)

	return nil
}

func (connection *ipTableConnection) LocalAddr() net.Addr {
	if connection.defaultConnection != nil {
		return connection.defaultConnection.LocalAddr()
	}

	return nil
}

func (connection *ipTableConnection) SetDeadline(t time.Time) error {
	if connection.defaultConnection != nil {
		connection.defaultConnection.SetDeadline(t)
	}

	connection.connectionMapThread.Lock()
	defer connection.connectionMapThread.Unlock()

	for _, subconnection := range connection.connectionMap {
		subconnection.SetDeadline(t)
	}

	return nil
}

func (connection *ipTableConnection) SetReadDeadline(t time.Time) error {
	if connection.defaultConnection != nil {
		connection.defaultConnection.SetReadDeadline(t)
	}

	connection.connectionMapThread.Lock()
	defer connection.connectionMapThread.Unlock()

	for _, subconnection := range connection.connectionMap {
		subconnection.SetReadDeadline(t)
	}

	return nil
}

func (connection *ipTableConnection) SetWriteDeadline(t time.Time) error {
	if connection.defaultConnection != nil {
		connection.defaultConnection.SetWriteDeadline(t)
	}

	connection.connectionMapThread.Lock()
	defer connection.connectionMapThread.Unlock()

	for _, subconnection := range connection.connectionMap {
		subconnection.SetWriteDeadline(t)
	}

	return nil
}

func (connection *ipTableConnection) forwardPackets(subconnection net.PacketConn) {
	defer connection.forwardCounter.Done()
	readBuffer := make([]byte, 65536) // Max UDP packet size
	for {
		numBytes, remoteAddr, err := subconnection.ReadFrom(readBuffer)
		if err != nil {
			return
		}

		packet := make([]byte, numBytes)
		copy(packet, readBuffer[:numBytes])

		connection.forwardedPackets <- incomingPacket{data: packet, addr: remoteAddr}
	}
}
