// Copyright 2024 The Outline Authors
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

package config

import (
	"context"
	"errors"
	"net"
	"net/netip"
	"time"

	"github.com/Jigsaw-Code/outline-sdk/network"
)

// packetConn is a net.PacketConn that sends and receives packets from a PacketProxy.
type packetConn struct {
	sender   network.PacketRequestSender
	receiver *packetReceiver
	readChan chan *packet
	local    net.Addr
	ctx      context.Context
	cancel   context.CancelFunc
}

type packet struct {
	data   []byte
	source net.Addr
}

// packetReceiver implements network.PacketResponseReceiver to receive packets from the PacketProxy.
type packetReceiver struct {
	writeChan chan<- *packet
	ctx       context.Context
}

func (r *packetReceiver) WriteFrom(p []byte, source net.Addr) (int, error) {
	if r.ctx.Err() != nil {
		return 0, r.ctx.Err()
	}
	// The buffer is owned by the caller, so we need to make a copy.
	data := make([]byte, len(p))
	copy(data, p)
	select {
	case r.writeChan <- &packet{data, source}:
		return len(p), nil
	case <-r.ctx.Done():
		return 0, r.ctx.Err()
	}
}

func (r *packetReceiver) Close() error {
	// Closing the channel is handled by the packetConn.
	return nil
}

func newPacketConn(ctx context.Context, proxy network.PacketProxy, localAddr net.Addr) (net.PacketConn, error) {
	connCtx, connCancel := context.WithCancel(ctx)

	readChan := make(chan *packet, 10)
	receiver := &packetReceiver{readChan, connCtx}

	sender, err := proxy.NewSession(receiver)
	if err != nil {
		connCancel()
		close(readChan)
		return nil, err
	}

	pc := &packetConn{
		sender:   sender,
		receiver: receiver,
		readChan: readChan,
		local:    localAddr,
		ctx:      connCtx,
		cancel:   connCancel,
	}

	go func() {
		<-connCtx.Done()
		pc.sender.Close()
		close(pc.readChan)
	}()

	return pc, nil
}

func (c *packetConn) ReadFrom(p []byte) (n int, addr net.Addr, err error) {
	select {
	case pkt, ok := <-c.readChan:
		if !ok {
			return 0, nil, errors.New("connection closed")
		}
		n = copy(p, pkt.data)
		return n, pkt.source, nil
	case <-c.ctx.Done():
		return 0, nil, c.ctx.Err()
	}
}

func (c *packetConn) WriteTo(p []byte, addr net.Addr) (n int, err error) {
	udpAddr, ok := addr.(*net.UDPAddr)
	if !ok {
		return 0, errors.New("address is not a UDP address")
	}
	ipPort := netip.AddrPortFrom(udpAddr.AddrPort().Addr(), udpAddr.AddrPort().Port())
	return c.sender.WriteTo(p, ipPort)
}

func (c *packetConn) Close() error {
	c.cancel()
	return nil
}

func (c *packetConn) LocalAddr() net.Addr {
	return c.local
}

func (c *packetConn) SetDeadline(t time.Time) error {
	return &net.OpError{Op: "setdeadline", Net: "packet", Source: nil, Addr: nil, Err: errors.New("not supported")}
}

func (c *packetConn) SetReadDeadline(t time.Time) error {
	return &net.OpError{Op: "setreaddeadline", Net: "packet", Source: nil, Addr: nil, Err: errors.New("not supported")}
}

func (c *packetConn) SetWriteDeadline(t time.Time) error {
	return &net.OpError{Op: "setwritedeadline", Net: "packet", Source: nil, Addr: nil, Err: errors.New("not supported")}
}
