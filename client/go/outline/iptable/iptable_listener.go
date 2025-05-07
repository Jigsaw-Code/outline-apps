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

// IPTablePacketListener is a transport.PacketListener that uses an IPTable
// to determine how to handle packets.
// When ListenPacket is called, it returns an ipTableConnection.
// This ipTableConnection will use the defaultListener to establish a primary
// listening PacketConn.
// When ipTableConnection.WriteTo is called for a destination IP:
//  1. It checks if a specific net.PacketConn for that destination's listener
//     already exists in its internal cache.
//  2. If not, it consults the IPTable[transport.PacketListener] (passed at creation).
//     - If a specific transport.PacketListener is found for the destination's prefix,
//     it's used to create a new net.PacketConn. This new PacketConn is cached,
//     and a goroutine starts reading from it, forwarding packets
//     to a central queue.
//     - If no specific listener is found, the primary PacketConn (from defaultListener)
//     is used for the write.
//  3. The packet is written using the selected net.PacketConn.
//
// When ipTableConnection.ReadFrom is called, it reads from the central queue,
// which aggregates packets from the primary PacketConn and all specific PacketConns.
type IPTablePacketListener struct {
	table           IPTable[transport.PacketListener]
	defaultListener transport.PacketListener
}

var _ transport.PacketListener = (*IPTablePacketListener)(nil)

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

// SetDefault allows changing the default listener.
// Note: This will not affect ipTableConnection instances already created by ListenPacket.
func (listener *IPTablePacketListener) SetDefault(defaultListener transport.PacketListener) {
	listener.defaultListener = defaultListener
}

// ListenPacket creates a new ipTableConnection.
// The context passed here is used for the initial ListenPacket call on the defaultListener
// and for subsequent ListenPacket calls on specific listeners.
func (listener *IPTablePacketListener) ListenPacket(ctx context.Context) (net.PacketConn, error) {
	return newIPTableConnection(ctx, listener.table, listener.defaultListener)
}

const packetQueueSize = 128 // Arbitrary size for the packet queue

type incomingPacket struct {
	data []byte
	addr net.Addr
}

type ipTableConnection struct {
	listenerTable   IPTable[transport.PacketListener]
	defaultListener transport.PacketListener // Fallback for specific conns
	defaultConn     net.PacketConn

	connsByAddr map[net.Addr]net.PacketConn

	packetQueue chan incomingPacket
	waitCounter sync.WaitGroup // To wait for readLoops to finish
	closeOnce   sync.Once
	ctx             context.Context
	cancelCtx       context.CancelFunc
}

var _ net.PacketConn = (*ipTableConnection)(nil)

func newIPTableConnection(
	parentCtx context.Context,
	listenerTable IPTable[transport.PacketListener],
	defaultListener transport.PacketListener,
) (*ipTableConnection, error) {
	ctx, cancel := context.WithCancel(parentCtx)

	var defaultConn net.PacketConn
	if defaultListener != nil {
		defaultConnAttempt, err := defaultListener.ListenPacket(ctx)

		if err != nil {
			defaultConn = nil
		} else {
			defaultConn = defaultConnAttempt
		}
	}

	specificConnsByListener := make(map[transport.PacketListener]net.PacketConn)

	if defaultConn != nil {
		specificConnsByListener[defaultListener] = defaultConn
	}

	connection := &ipTableConnection{
		ctx:                     ctx,
		cancelCtx:               cancel,
		listenerTable:           listenerTable,
		defaultListener:         defaultListener,
		defaultConn:             defaultConn,
		specificConnsByListener: specificConnsByListener,
		packetQueue:             make(chan incomingPacket, packetQueueSize),
	}

	if connection.defaultConn != nil {
		connection.waitCounter.Add(1)
		go connection.forwardToQueue(connection.defaultConn)
	}

	return connection, nil
}

func (connection *ipTableConnection) forwardToQueue(subconnection net.PacketConn) {
	defer connection.waitCounter.Done()
	readBuffer := make([]byte, 65536) // Max UDP packet size
	for {
		numBytes, remoteAddr, err := subconnection.ReadFrom(readBuffer)
		if err != nil {
			return
		}

		packet := make([]byte, numBytes)
		copy(packet, readBuffer[:numBytes])

		connection.packetQueue <- incomingPacket{data: packet, addr: remoteAddr}:
	}
}

func (connection *ipTableConnection) ReadFrom(result []byte) (n int, addr net.Addr, err error) {
	// packet, ok := <- connection.packetQueue;
	// if !ok {
	// 	return 0, nil, net.ErrClosed
	// }
	// can we lengthen the buffer if it's too short?
	// numBytes = copy(result, packet.data)
	// return numBytes, packet.addr, nil;
}

// func (c *ipTableConnection) getOrCreateSpecificConn(remoteAddr net.Addr) (net.PacketConn, error) {
// 	host, _, err := net.SplitHostPort(remoteAddr.String())
// 	if err != nil {
// 		// If remoteAddr is not "host:port", it might be an IP already or unparseable.
// 		// Try to parse it as a plain IP. If not, fallback.
// 		host = remoteAddr.String()
// 	}

// 	remoteIP, err := netip.ParseAddr(host)
// 	if err != nil {
// 		// Cannot parse IP from remoteAddr, use primary connection.
// 		return c.defaultConn, nil
// 	}

// 	listener, listenerFound := c.listenerTable.Lookup(remoteIP)
// 	if !listenerFound {
// 		// No specific listener for this IP, use the primary connection.
// 		return c.defaultConn, nil
// 	}

// 	// A specific listener was found. Check cache.
// 	c.specificConnsMutex.RLock()
// 	cachedConn, exists := c.specificConnsByListener[listener]
// 	c.specificConnsMutex.RUnlock()

// 	if exists {
// 		return cachedConn, nil
// 	}

// 	// Not in cache, need to create and add it.
// 	c.specificConnsMutex.Lock()
// 	defer c.specificConnsMutex.Unlock()

// 	// Double-check if another goroutine created it while waiting for the lock.
// 	if cachedConn, exists = c.specificConnsByListener[listener]; exists {
// 		return cachedConn, nil
// 	}

// 	newSpecificConn, err := listener.ListenPacket(c.ctx) // Use the connection's context
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to listen on specific listener for %s (resolved to %s): %w", remoteAddr.String(), remoteIP.String(), err)
// 	}

// 	c.specificConnsByListener[listener] = newSpecificConn
// 	c.waitCounter.Add(1)
// 	go c.readLoop(newSpecificConn)

// 	return newSpecificConn, nil
// }

func (c *ipTableConnection) WriteTo(packet []byte, addr net.Addr) (n int, err error) {
	connToUse, err := c.getOrCreateSpecificConn(addr)
	if err != nil {
		return 0, fmt.Errorf("could not get/create connection for %s: %w", addr.String(), err)
	}

	return connToUse.WriteTo(p, addr)
}

func (c *ipTableConnection) Close() error {
	c.closeOnce.Do(func() {
		c.cancelCtx()

		c.specificConnsMutex.Lock()
		for listener, sc := range c.specificConnsByListener {
			sc.Close()
			delete(c.specificConnsByListener, listener)
		}
		c.specificConnsMutex.Unlock()

		if c.defaultConn != nil {
			c.defaultConn.Close()
		}

		c.waitCounter.Wait() // Wait for all readLoops to finish.
		close(c.packetQueue)
	})
	return nil
}

func (c *ipTableConnection) LocalAddr() net.Addr {
	if c.defaultConn != nil {
		return c.defaultConn.LocalAddr()
	}

	return nil
}

func (c *ipTableConnection) SetDeadline(t time.Time) error {
	return c.applyToAllConns(func(pc net.PacketConn) error {
		return pc.SetDeadline(t)
	})
}

func (c *ipTableConnection) SetReadDeadline(t time.Time) error {
	return c.applyToAllConns(func(pc net.PacketConn) error {
		return pc.SetReadDeadline(t)
	})
}

func (c *ipTableConnection) SetWriteDeadline(t time.Time) error {
	return c.applyToAllConns(func(pc net.PacketConn) error {
		return pc.SetWriteDeadline(t)
	})
}
