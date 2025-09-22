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
	"sync/atomic"
	"time"

	"golang.org/x/net/dns/dnsmessage"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/connectivity"
	"github.com/Jigsaw-Code/outline-sdk/dns"
	"github.com/Jigsaw-Code/outline-sdk/network"
	"github.com/Jigsaw-Code/outline-sdk/network/dnstruncate"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

func WrapDNSInterceptedStreamDialer(sd transport.StreamDialer, localDNSAddr, resolverAddr string) (transport.StreamDialer, error) {
	if sd == nil {
		return nil, errors.New("base StreamDialer must be provided for DNS interception")
	}
	localDNS, err := parseAddrPortWithDefaultPort(localDNSAddr, 53)
	if err != nil {
		return nil, fmt.Errorf("local DNS address to be intercepted is not valid: %w", err)
	}
	resolv := dns.NewTCPResolver(sd, resolverAddr)
	return transport.FuncStreamDialer(func(ctx context.Context, addr string) (transport.StreamConn, error) {
		if dst, err := netip.ParseAddrPort(addr); err == nil && isEquivalentAddrPort(dst, localDNS) {
			return newDNSResolverStreamConn(resolv), nil
		}
		return sd.DialStream(ctx, addr)
	}), nil
}

func WrapDNSInterceptedPacketProxy(pl transport.PacketListener, localDNSAddr, resolverAddr string) (network.PacketProxy, error) {
	if pl == nil {
		return nil, errors.New("base PacketProxy must be provided for DNS interception")
	}
	pp, err := network.NewPacketProxyFromPacketListener(pl)
	if err != nil {
		return nil, fmt.Errorf("failed to wrap a PacketListener into PacketProxy")
	}
	resolver, err := parseAddrPortWithDefaultPort(resolverAddr, 53)
	if err != nil {
		return nil, fmt.Errorf("TCP resolver address is not valid: %w", err)
	}
	localDNS, err := parseAddrPortWithDefaultPort(localDNSAddr, 53)
	if err != nil {
		return nil, fmt.Errorf("local DNS address to be intercepted is not valid: %w", err)
	}
	trunc, err := dnstruncate.NewPacketProxy()
	if err != nil {
		return nil, fmt.Errorf("failed to create fallback (truncated) DNS PacketProxy")
	}
	return &dnsInterceptPacketProxy{
		base:           pp,
		trunc:          trunc,
		local:          localDNS,
		resolv:         resolver,
		udpHealthCheck: func() error { return connectivity.CheckUDPConnectivity(pl) },
	}, nil
}

func parseAddrPortWithDefaultPort(addr string, defaultPort uint16) (netip.AddrPort, error) {
	ap, err := netip.ParseAddrPort(addr)
	if err == nil {
		return ap, nil
	}
	ip, err := netip.ParseAddr(addr)
	if err != nil {
		return netip.AddrPort{}, err
	}
	return netip.AddrPortFrom(ip, defaultPort), nil
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
	base, trunc network.PacketProxy
	useBaseDNS  atomic.Bool

	local, resolv  netip.AddrPort
	udpHealthCheck func() error
}

type dnsInterceptPacketReqSender struct {
	pp          *dnsInterceptPacketProxy
	base, trunc network.PacketRequestSender
}

type dnsInterceptPacketRespReceiver struct {
	network.PacketResponseReceiver
	pp *dnsInterceptPacketProxy
}

var _ network.PacketProxy = (*dnsInterceptPacketProxy)(nil)
var _ network.PacketRequestSender = (*dnsInterceptPacketReqSender)(nil)
var _ network.PacketResponseReceiver = (*dnsInterceptPacketRespReceiver)(nil)

func (pp *dnsInterceptPacketProxy) NewSession(resp network.PacketResponseReceiver) (_ network.PacketRequestSender, err error) {
	base, err := pp.base.NewSession(&dnsInterceptPacketRespReceiver{resp, pp})
	if err != nil {
		return nil, err
	}
	trunc, err := pp.trunc.NewSession(resp)
	if err != nil {
		slog.Warn("failed to create DNS truncate session, will always route DNS via base UDP", "err", err)
	}
	return &dnsInterceptPacketReqSender{
		pp:    pp,
		base:  base,
		trunc: trunc,
	}, nil
}

func (pp *dnsInterceptPacketProxy) OnNotifyNetworkChanged() {
	go func() {
		slog.Debug("checking UDP connectivity...")
		if err := pp.udpHealthCheck(); err == nil {
			slog.Info("remote device UDP is healthy")
			pp.useBaseDNS.Store(true)
		} else {
			slog.Info("remote device UDP is not healthy", "err", err)
			pp.useBaseDNS.Store(false)
		}
	}()
}

// WriteTo intercepts outgoing DNS request packets.
// If a packet is destined for the local resolver, it remaps the destination to the remote resolver.
// It will fallback to an always-truncate resolver if remote UDP is unhealthy.
func (req *dnsInterceptPacketReqSender) WriteTo(p []byte, destination netip.AddrPort) (int, error) {
	if isEquivalentAddrPort(destination, req.pp.local) {
		if req.trunc != nil && !req.pp.useBaseDNS.Load() {
			return req.trunc.WriteTo(p, destination)
		}
		destination = req.pp.resolv
	}
	return req.base.WriteTo(p, destination)
}

func (req *dnsInterceptPacketReqSender) Close() (err error) {
	err = req.base.Close()
	req.trunc.Close()
	return
}

// ReadFrom intercepts incoming DNS response packets.
// If a packet is received from the remote resolver, it remaps the source address to be the local resolver.
func (resp *dnsInterceptPacketRespReceiver) WriteFrom(p []byte, source net.Addr) (int, error) {
	if addr, ok := source.(*net.UDPAddr); ok && isEquivalentAddrPort(addr.AddrPort(), resp.pp.resolv) {
		source = net.UDPAddrFromAddrPort(resp.pp.local)
	}
	return resp.PacketResponseReceiver.WriteFrom(p, source)
}
