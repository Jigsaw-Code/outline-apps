// Copyright 2023 The Outline Authors
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

package connectivity

import (
	"context"
	"errors"
	"net"
	"testing"
	"time"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-sdk/transport"
	"github.com/Jigsaw-Code/outline-sdk/transport/shadowsocks"
	"github.com/stretchr/testify/require"
)

func TestCheckUDPConnectivityWithDNS_Success(t *testing.T) {
	client := &fakeSSClient{}
	err := CheckUDPConnectivityWithDNS(client, &net.UDPAddr{})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
}

func TestCheckUDPConnectivityWithDNS_Fail(t *testing.T) {
	client := &fakeSSClient{failUDP: true}
	err := CheckUDPConnectivityWithDNS(client, &net.UDPAddr{})
	if err == nil {
		t.Fail()
	}
}

func TestCheckTCPConnectivityWithHTTP_Success(t *testing.T) {
	client := &fakeSSClient{}
	err := CheckTCPConnectivityWithHTTP(client, "")
	if err != nil {
		t.Fail()
	}
}

func TestCheckTCPConnectivityWithHTTP_FailReachability(t *testing.T) {
	client := &fakeSSClient{failReachability: true}
	err := CheckTCPConnectivityWithHTTP(client, "")
	require.Error(t, err)
	perr := platerrors.ToPlatformError(err)
	require.Equal(t, platerrors.ProxyServerUnreachable, perr.Code)
}

func TestCheckTCPConnectivityWithHTTP_FailAuthentication(t *testing.T) {
	client := &fakeSSClient{failAuthentication: true}
	err := CheckTCPConnectivityWithHTTP(client, "")
	require.Error(t, err)
	perr := platerrors.ToPlatformError(err)
	require.Equal(t, platerrors.ProxyServerReadFailed, perr.Code)
}

// Fake shadowsocks.Client that can be configured to return failing UDP and TCP connections.
type fakeSSClient struct {
	failReachability   bool
	failAuthentication bool
	failUDP            bool
}

func (c *fakeSSClient) DialStream(_ context.Context, raddr string) (transport.StreamConn, error) {
	if c.failReachability {
		// OpError.Error() panics if Err is nil.
		return nil, &net.OpError{Err: errors.New("unreachable fakeSSClient")}
	}
	return &fakeDuplexConn{failRead: c.failAuthentication}, nil
}
func (c *fakeSSClient) ListenPacket(_ context.Context) (net.PacketConn, error) {
	conn, err := net.ListenPacket("udp", "")
	if err != nil {
		return nil, err
	}
	// The UDP check should fail if any of the failure conditions are true since it is a superset of the others.
	failRead := c.failAuthentication || c.failUDP || c.failReachability
	return &fakePacketConn{PacketConn: conn, failRead: failRead}, nil
}
func (c *fakeSSClient) SetTCPSaltGenerator(salter shadowsocks.SaltGenerator) {
}

// Fake PacketConn that fails `ReadFrom` calls when `failRead` is true.
type fakePacketConn struct {
	net.PacketConn
	addr     net.Addr
	failRead bool
}

func (c *fakePacketConn) WriteTo(b []byte, addr net.Addr) (int, error) {
	c.addr = addr
	return len(b), nil // Write always succeeds
}

func (c *fakePacketConn) ReadFrom(b []byte) (int, net.Addr, error) {
	if c.failRead {
		return 0, c.addr, errors.New("Fake read error")
	}
	return len(b), c.addr, nil
}

// Fake DuplexConn that fails `Read` calls when `failRead` is true.
type fakeDuplexConn struct {
	transport.StreamConn
	failRead bool
}

func (c *fakeDuplexConn) Read(b []byte) (int, error) {
	if c.failRead {
		return 0, errors.New("Fake read error")
	}
	return len(b), nil
}

func (c *fakeDuplexConn) Write(b []byte) (int, error) {
	return len(b), nil // Write always succeeds
}

func (c *fakeDuplexConn) Close() error { return nil }

func (c *fakeDuplexConn) LocalAddr() net.Addr { return nil }

func (c *fakeDuplexConn) RemoteAddr() net.Addr { return nil }

func (c *fakeDuplexConn) SetDeadline(t time.Time) error { return nil }

func (c *fakeDuplexConn) SetReadDeadline(t time.Time) error { return nil }

func (c *fakeDuplexConn) SetWriteDeadline(t time.Time) error { return nil }

func (c *fakeDuplexConn) CloseRead() error { return nil }

func (c *fakeDuplexConn) CloseWrite() error { return nil }
