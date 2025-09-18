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

package vpn

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/netip"
	"time"

	"golang.org/x/net/dns/dnsmessage"

	"github.com/Jigsaw-Code/outline-sdk/dns"
	"github.com/Jigsaw-Code/outline-sdk/network"
	"github.com/Jigsaw-Code/outline-sdk/network/dnstruncate"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

type DNSInterceptor struct {
	local  netip.AddrPort
	resolv dns.Resolver
}

func NewDNSInterceptor(localDNSAddr string, resolver dns.Resolver) (*DNSInterceptor, error) {
	if resolver == nil {
		return nil, errors.New("resolver must be provided")
	}
	addr, err := netip.ParseAddr(localDNSAddr)
	if err != nil {
		return nil, fmt.Errorf("a valid local DNS address must be provided: %w", err)
	}
	// We use a fixed port 53 here because dnstruncate requires port 53
	// And Android also doesn't allow us to configure the port
	return &DNSInterceptor{netip.AddrPortFrom(addr, 53), resolver}, nil
}

func (di *DNSInterceptor) NewStreamDialer(sd transport.StreamDialer) (transport.StreamDialer, error) {
	return transport.FuncStreamDialer(func(ctx context.Context, addr string) (transport.StreamConn, error) {
		if dst, err := netip.ParseAddrPort(addr); err == nil && isEquivalentAddrPort(dst, di.local) {
			slog.Debug("intercepting DNS request (TCP)", "addr", addr)
			return newDNSResolverStreamConn(di.resolv), nil
		}
		return sd.DialStream(ctx, addr)
	}), nil
}

func (di *DNSInterceptor) NewPacketProxy(pp network.PacketProxy) (network.PacketProxy, error) {
	return newDNSInterceptPacketProxy(di.local, pp)
}

func (di *DNSInterceptor) OnNotifyNetworkChanged() {
	type NetworkChangeNotifier interface{ OnNotifyNetworkChanged() }
	if ncn, ok := di.resolv.(NetworkChangeNotifier); ok {
		ncn.OnNotifyNetworkChanged()
	}
}

func isEquivalentAddrPort(addr1, addr2 netip.AddrPort) bool {
	return addr1.Addr().Unmap() == addr2.Addr().Unmap() && addr1.Port() == addr2.Port()
}

// ----- DNS Interceptor StreamConn -----

type dnsResolverStreamConn struct {
	net.Conn
	peer net.Conn
	r    dns.Resolver
}

var _ transport.StreamConn = (*dnsResolverStreamConn)(nil)

func newDNSResolverStreamConn(resolver dns.Resolver) transport.StreamConn {
	client, server := net.Pipe()
	conn := &dnsResolverStreamConn{Conn: client, peer: server, r: resolver}
	go conn.Serve()
	return conn
}

func (c *dnsResolverStreamConn) Close() error {
	return errors.Join(c.CloseRead(), c.CloseWrite())
}

func (c *dnsResolverStreamConn) CloseRead() error {
	return c.peer.Close()
}

func (c *dnsResolverStreamConn) CloseWrite() error {
	return c.Conn.Close()
}

func (c *dnsResolverStreamConn) Serve() {
	defer c.Close()
	for {
		var reqLen uint16
		if err := binary.Read(c.peer, binary.BigEndian, &reqLen); err != nil {
			return
		}
		buf := make([]byte, reqLen)
		if _, err := io.ReadFull(c.peer, buf); err != nil {
			return
		}
		parser := dnsmessage.Parser{}
		reqHdr, err := parser.Start(buf)
		if err != nil {
			return
		}
		q, err := parser.Question()
		if err != nil {
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		ans, err := c.r.Query(ctx, q)
		cancel()
		if err != nil {
			return
		}
		ans.Header.ID = reqHdr.ID
		resp, err := ans.Pack()
		if err != nil {
			return
		}
		var respLen [2]byte
		binary.BigEndian.PutUint16(respLen[:], uint16(len(resp)))
		if _, err := c.peer.Write(respLen[:]); err != nil {
			return
		}
		if _, err := c.peer.Write(resp); err != nil {
			return
		}
	}
}

// ----- DNS Interceptor PacketProxy -----

type dnsInterceptPacketProxy struct {
	localDNSAddr netip.AddrPort
	def, dns     network.PacketProxy
}

type dnsInterceptPacketReqSender struct {
	localDNSAddr netip.AddrPort
	def, dns     network.PacketRequestSender
}

var _ network.PacketProxy = (*dnsInterceptPacketProxy)(nil)
var _ network.PacketRequestSender = (*dnsInterceptPacketReqSender)(nil)

func newDNSInterceptPacketProxy(localAddr netip.AddrPort, udp network.PacketProxy) (*dnsInterceptPacketProxy, error) {
	dns, err := dnstruncate.NewPacketProxy()
	if err != nil {
		return nil, err
	}
	return &dnsInterceptPacketProxy{localAddr, udp, dns}, nil
}

func (pp *dnsInterceptPacketProxy) NewSession(resp network.PacketResponseReceiver) (req network.PacketRequestSender, err error) {
	sender := &dnsInterceptPacketReqSender{localDNSAddr: pp.localDNSAddr}
	sender.def, err = pp.def.NewSession(resp)
	if err != nil {
		return
	}
	defer func() {
		if err != nil {
			sender.def.Close()
		}
	}()
	sender.dns, err = pp.dns.NewSession(resp)
	if err != nil {
		return nil, err
	}
	return sender, nil
}

func (req *dnsInterceptPacketReqSender) WriteTo(p []byte, destination netip.AddrPort) (int, error) {
	if isEquivalentAddrPort(destination, req.localDNSAddr) {
		return req.dns.WriteTo(p, destination)
	}
	return req.def.WriteTo(p, destination)
}

func (req *dnsInterceptPacketReqSender) Close() error {
	return errors.Join(req.def.Close(), req.dns.Close())
}
