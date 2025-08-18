// Copyright 2023 Jigsaw Operations LLC
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

package outline

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"sync/atomic"
	"time"

	"localhost/Intra/Android/app/src/go/doh"
	"localhost/Intra/Android/app/src/go/intra/protect"
	"localhost/Intra/Android/app/src/go/intra/split"

	"github.com/Jigsaw-Code/outline-sdk/transport"
)

type intraStreamDialer struct {
	fakeDNSAddr netip.AddrPort
	dns         atomic.Pointer[doh.Resolver]
	dialer      *net.Dialer
	listener    TCPListener
	sniReporter *tcpSNIReporter
}

var _ transport.StreamDialer = (*intraStreamDialer)(nil)

func newIntraStreamDialer(
	fakeDNS netip.AddrPort,
	dns doh.Resolver,
	protector protect.Protector,
	listener TCPListener,
	sniReporter *tcpSNIReporter,
) (*intraStreamDialer, error) {
	if dns == nil {
		return nil, errors.New("dns is required")
	}

	dohsd := &intraStreamDialer{
		fakeDNSAddr: fakeDNS,
		dialer:      protect.MakeDialer(protector),
		listener:    listener,
		sniReporter: sniReporter,
	}
	dohsd.dns.Store(&dns)
	return dohsd, nil
}

// Dial implements StreamDialer.Dial.
func (sd *intraStreamDialer) Dial(ctx context.Context, raddr string) (transport.StreamConn, error) {
	dest, err := netip.ParseAddrPort(raddr)
	if err != nil {
		return nil, fmt.Errorf("invalid raddr (%v): %w", raddr, err)
	}

	if isEquivalentAddrPort(dest, sd.fakeDNSAddr) {
		src, dst := net.Pipe()
		go doh.Accept(*sd.dns.Load(), dst)
		return newStreamConnFromPipeConns(src, dst)
	}

	stats := makeTCPSocketSummary(dest)
	beforeConn := time.Now()
	conn, err := sd.dial(ctx, dest, stats)
	if err != nil {
		return nil, fmt.Errorf("failed to dial to target: %w", err)
	}
	stats.Synack = int32(time.Since(beforeConn).Milliseconds())

	return makeTCPWrapConn(conn, stats, sd.listener, sd.sniReporter), nil
}

func (sd *intraStreamDialer) SetDNS(dns doh.Resolver) error {
	if dns == nil {
		return errors.New("dns is required")
	}
	sd.dns.Store(&dns)
	return nil
}

func (sd *intraStreamDialer) dial(ctx context.Context, dest netip.AddrPort, stats *TCPSocketSummary) (transport.StreamConn, error) {
	if dest.Port() == 443 {
		stats.Retry = &split.RetryStats{}
		return split.DialWithSplitRetry(ctx, sd.dialer, net.TCPAddrFromAddrPort(dest), stats.Retry)
	} else {
		tcpsd := &transport.TCPStreamDialer{
			Dialer: *sd.dialer,
		}
		return tcpsd.Dial(ctx, dest.String())
	}
}

// transport.StreamConn wrapper around net.Pipe call

type pipeconn struct {
	net.Conn
	remote net.Conn
}

var _ transport.StreamConn = (*pipeconn)(nil)

// newStreamConnFromPipeConns creates a new [transport.StreamConn] that wraps around the local [net.Conn].
// The remote [net.Conn] will be closed when you call CloseRead() on the returned [transport.StreamConn]
func newStreamConnFromPipeConns(local, remote net.Conn) (transport.StreamConn, error) {
	if local == nil || remote == nil {
		return nil, errors.New("local conn and remote conn are required")
	}
	return &pipeconn{local, remote}, nil
}

func (c *pipeconn) Close() error {
	return errors.Join(c.CloseRead(), c.CloseWrite())
}

// CloseRead makes sure all read on the local conn returns io.EOF, and write on the remote conn returns ErrClosedPipe.
func (c *pipeconn) CloseRead() error {
	return c.remote.Close()
}

// CloseWrite makes sure all read on the remote conn returns io.EOF, and write on the local conn returns ErrClosedPipe.
func (c *pipeconn) CloseWrite() error {
	return c.Conn.Close()
}