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

package outline

import (
	"context"
	"errors"
	"net"
	"net/netip"
	"testing"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/iptable"
	"github.com/Jigsaw-Code/outline-sdk/transport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// MockStreamConn satisfies transport.StreamConn but does minimal work.
type MockStreamConn struct {
	net.Conn
	closed bool
	local  net.Addr
	remote net.Addr
}

func (m *MockStreamConn) Close() error {
	m.closed = true
	return nil
}
func (m *MockStreamConn) CloseRead() error  { return nil }
func (m *MockStreamConn) CloseWrite() error { return nil }
func (m *MockStreamConn) LocalAddr() net.Addr {
	if m.local == nil {
		m.local = &net.TCPAddr{IP: net.ParseIP("127.0.0.1"), Port: 12345}
	}
	return m.local
}
func (m *MockStreamConn) RemoteAddr() net.Addr {
	if m.remote == nil {
		m.remote = &net.TCPAddr{IP: net.ParseIP("8.8.8.8"), Port: 53}
	}
	return m.remote
}

// MockStreamDialer records calls to DialStream.
type MockStreamDialer struct {
	Name        string
	WasCalled   bool
	DialedAddr  string
	DialedCtx   context.Context
	ReturnConn  transport.StreamConn
	ReturnError error
}

func NewMockStreamDialer(name string) *MockStreamDialer {
	return &MockStreamDialer{
		Name:       name,
		ReturnConn: &MockStreamConn{},
	}
}

func (m *MockStreamDialer) DialStream(ctx context.Context, addr string) (transport.StreamConn, error) {
	m.WasCalled = true
	m.DialedCtx = ctx
	m.DialedAddr = addr

	if m.ReturnError != nil {
		return nil, m.ReturnError
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return m.ReturnConn, nil
}

func (m *MockStreamDialer) Reset() {
	m.WasCalled = false
	m.DialedAddr = ""
	m.DialedCtx = nil
}

func TestNewIPTableStreamDialer(t *testing.T) {
	defaultDialer := NewMockStreamDialer("default")
	table := iptable.NewIPTable[transport.StreamDialer]()

	t.Run("Valid", func(t *testing.T) {
		d, err := NewIPTableStreamDialer(table, defaultDialer)
		require.NoError(t, err)
		require.NotNil(t, d)
		assert.Equal(t, defaultDialer, d.defaultDialer)
		assert.Equal(t, table, d.table)
	})

	t.Run("Nil Table", func(t *testing.T) {
		d, err := NewIPTableStreamDialer(nil, defaultDialer)
		require.NoError(t, err)
		require.NotNil(t, d)
		assert.Equal(t, defaultDialer, d.defaultDialer)
		assert.NotNil(t, d.table, "Table should be initialized even if nil is passed")
	})

	t.Run("Nil Default Dialer", func(t *testing.T) {
		d, err := NewIPTableStreamDialer(table, nil)
		require.Error(t, err)
		assert.Nil(t, d)
	})
}

func TestIPTableStreamDialer_DialStream(t *testing.T) {
	defaultDialer := NewMockStreamDialer("default")
	routeV4Dialer := NewMockStreamDialer("routeV4") // 192.0.2.0/24
	routeV6Dialer := NewMockStreamDialer("routeV6") // 2001:db8:cafe::/48

	table := iptable.NewIPTable[transport.StreamDialer]()
	prefixV4, _ := netip.ParsePrefix("192.0.2.0/24")
	prefixV6, _ := netip.ParsePrefix("2001:db8:cafe::/48")
	table.AddPrefix(prefixV4, routeV4Dialer)
	table.AddPrefix(prefixV6, routeV6Dialer)

	iptDialer, err := NewIPTableStreamDialer(table, defaultDialer)
	require.NoError(t, err)
	require.NotNil(t, iptDialer)

	testCases := []struct {
		name         string
		address      string
		expectDialer *MockStreamDialer
		expectConn   bool
		expectErr    bool
		setupMocks   func()
	}{
		{
			name:         "IPv4 in table with port",
			address:      "192.0.2.100:443",
			expectDialer: routeV4Dialer,
			expectConn:   true,
		},
		{
			name:         "IPv4 in table no port",
			address:      "192.0.2.55",
			expectDialer: routeV4Dialer,
			expectConn:   true,
		},
		{
			name:         "IPv6 in table with port",
			address:      "[2001:db8:cafe::1]:8080",
			expectDialer: routeV6Dialer,
			expectConn:   true,
		},
		{
			name:         "IPv6 in table no port",
			address:      "2001:db8:cafe::bad:1",
			expectDialer: routeV6Dialer,
			expectConn:   true,
		},
		{
			name:         "IPv4 not in table with port",
			address:      "10.0.0.1:1234",
			expectDialer: defaultDialer,
			expectConn:   true,
		},
		{
			name:         "IPv4 not in table no port",
			address:      "8.8.8.8",
			expectDialer: defaultDialer,
			expectConn:   true,
		},
		{
			name:         "IPv6 not in table with port",
			address:      "[::1]:9000",
			expectDialer: defaultDialer,
			expectConn:   true,
		},
		{
			name:         "Hostname with port",
			address:      "example.com:443",
			expectDialer: defaultDialer,
			expectConn:   true,
		},
		{
			name:         "Hostname no port",
			address:      "localhost",
			expectDialer: defaultDialer,
			expectConn:   true,
		},
		{
			name:         "Invalid IP address format",
			address:      "not-an-ip-or-host:123",
			expectDialer: defaultDialer,
			expectConn:   true,
		},
		{
			name:         "Empty address",
			address:      "",
			expectDialer: defaultDialer,
			expectConn:   true,
		},
		{
			name:         "Dialer returns error",
			address:      "192.0.2.20:80",
			expectDialer: routeV4Dialer,
			expectErr:    true,
			setupMocks: func() {
				routeV4Dialer.ReturnError = errors.New("mock dial failed")
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			defaultDialer.Reset()
			routeV4Dialer.Reset()
			routeV6Dialer.Reset()
			defaultDialer.ReturnError = nil
			routeV4Dialer.ReturnError = nil
			routeV6Dialer.ReturnError = nil

			if tc.setupMocks != nil {
				tc.setupMocks()
			}

			ctx := context.Background()
			conn, err := iptDialer.DialStream(ctx, tc.address)

			if tc.expectErr {
				require.Error(t, err)
				assert.Nil(t, conn)
				if tc.expectDialer.ReturnError != nil {
					assert.ErrorIs(t, err, tc.expectDialer.ReturnError)
				}
			} else {
				require.NoError(t, err)
				if tc.expectConn {
					require.NotNil(t, conn)
					assert.Same(t, tc.expectDialer.ReturnConn, conn)
					conn.Close()
				} else {
					assert.Nil(t, conn)
				}
			}

			assert.True(t, tc.expectDialer.WasCalled, "Expected dialer %s to be called", tc.expectDialer.Name)
			if tc.expectDialer.WasCalled {
				assert.Equal(t, tc.address, tc.expectDialer.DialedAddr, "Dialed address mismatch")
				assert.Equal(t, ctx, tc.expectDialer.DialedCtx, "Dialed context mismatch")
			}

			allMocks := []*MockStreamDialer{defaultDialer, routeV4Dialer, routeV6Dialer}
			for _, mock := range allMocks {
				if mock != tc.expectDialer {
					assert.False(t, mock.WasCalled, "Dialer %s should NOT have been called", mock.Name)
				}
			}
		})
	}
}

type MockPacketDialer struct {
	Name        string
	WasCalled   bool
	DialedAddr  string
	DialedCtx   context.Context
	ReturnConn  net.Conn
	ReturnError error
}

func NewMockPacketDialer(name string) *MockPacketDialer {
	return &MockPacketDialer{
		Name:       name,
		ReturnConn: &MockStreamConn{},
	}
}

func (m *MockPacketDialer) DialPacket(ctx context.Context, addr string) (net.Conn, error) {
	m.WasCalled = true
	m.DialedCtx = ctx
	m.DialedAddr = addr

	if m.ReturnError != nil {
		return nil, m.ReturnError
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return m.ReturnConn, nil
}

func (m *MockPacketDialer) Reset() {
	m.WasCalled = false
	m.DialedAddr = ""
	m.DialedCtx = nil
}

func TestNewIPTablePacketDialer(t *testing.T) {
	defaultDialer := NewMockPacketDialer("default")
	table := iptable.NewIPTable[transport.PacketDialer]()

	t.Run("Valid", func(t *testing.T) {
		d, err := NewIPTablePacketDialer(table, defaultDialer)
		require.NoError(t, err)
		require.NotNil(t, d)
		assert.Equal(t, defaultDialer, d.defaultDialer)
		assert.Equal(t, table, d.table)
	})

	t.Run("Nil Table", func(t *testing.T) {
		d, err := NewIPTablePacketDialer(nil, defaultDialer)
		require.NoError(t, err)
		require.NotNil(t, d)
		assert.Equal(t, defaultDialer, d.defaultDialer)
		assert.NotNil(t, d.table, "Table should be initialized even if nil is passed")
	})

	t.Run("Nil Default Dialer", func(t *testing.T) {
		d, err := NewIPTablePacketDialer(table, nil)
		require.Error(t, err)
		assert.Nil(t, d)
		assert.Contains(t, err.Error(), "defaultRoute cannot be nil")
	})
}

func TestIPTablePacketDialer_DialPacket(t *testing.T) {
	defaultDialer := NewMockPacketDialer("default")
	routeV4Dialer := NewMockPacketDialer("routeV4") // 192.0.2.0/24
	routeV6Dialer := NewMockPacketDialer("routeV6") // 2001:db8:cafe::/48

	table := iptable.NewIPTable[transport.PacketDialer]()
	prefixV4, _ := netip.ParsePrefix("192.0.2.0/24")
	prefixV6, _ := netip.ParsePrefix("2001:db8:cafe::/48")
	table.AddPrefix(prefixV4, routeV4Dialer)
	table.AddPrefix(prefixV6, routeV6Dialer)

	iptDialer, err := NewIPTablePacketDialer(table, defaultDialer)
	require.NoError(t, err)
	require.NotNil(t, iptDialer)

	testCases := []struct {
		name         string
		address      string
		expectDialer *MockPacketDialer
		expectConn   bool
		expectErr    bool
		setupMocks   func()
	}{
		{
			name:         "IPv4 in table with port",
			address:      "192.0.2.100:53", // UDP port
			expectDialer: routeV4Dialer,
			expectConn:   true,
		},
		{
			name:         "IPv4 in table no port",
			address:      "192.0.2.55",
			expectDialer: routeV4Dialer,
			expectConn:   true,
		},
		{
			name:         "IPv6 in table with port",
			address:      "[2001:db8:cafe::1]:5353", // UDP port
			expectDialer: routeV6Dialer,
			expectConn:   true,
		},
		{
			name:         "IPv6 in table no port",
			address:      "2001:db8:cafe::bad:1",
			expectDialer: routeV6Dialer,
			expectConn:   true,
		},
		{
			name:         "IPv4 not in table with port",
			address:      "10.0.0.1:123", // UDP port
			expectDialer: defaultDialer,
			expectConn:   true,
		},
		{
			name:         "IPv4 not in table no port",
			address:      "8.8.8.8",
			expectDialer: defaultDialer,
			expectConn:   true,
		},
		{
			name:         "IPv6 not in table with port",
			address:      "[::1]:9001", // UDP port
			expectDialer: defaultDialer,
			expectConn:   true,
		},
		{
			name:         "Hostname with port",
			address:      "dns.google:53",
			expectDialer: defaultDialer,
			expectConn:   true,
		},
		{
			name:         "Hostname no port",
			address:      "localhost",
			expectDialer: defaultDialer,
			expectConn:   true,
		},
		{
			name:         "Invalid IP address format",
			address:      "not-an-ip-or-host:123",
			expectDialer: defaultDialer,
			expectConn:   true,
		},
		{
			name:         "Empty address",
			address:      "",
			expectDialer: defaultDialer,
			expectConn:   true,
		},
		{
			name:         "Dialer returns error",
			address:      "192.0.2.20:53", // Matches routeV4Dialer
			expectDialer: routeV4Dialer,
			expectErr:    true,
			setupMocks: func() {
				routeV4Dialer.ReturnError = errors.New("mock packet dial failed")
			},
		},
	}

	// Run Test Cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			defaultDialer.Reset()
			routeV4Dialer.Reset()
			routeV6Dialer.Reset()
			defaultDialer.ReturnError = nil
			routeV4Dialer.ReturnError = nil
			routeV6Dialer.ReturnError = nil

			if tc.setupMocks != nil {
				tc.setupMocks()
			}

			ctx := context.Background()
			conn, err := iptDialer.DialPacket(ctx, tc.address)

			if tc.expectErr {
				require.Error(t, err)
				assert.Nil(t, conn)
				if tc.expectDialer.ReturnError != nil {
					assert.ErrorIs(t, err, tc.expectDialer.ReturnError)
				}
			} else {
				require.NoError(t, err)
				if tc.expectConn {
					require.NotNil(t, conn)
					assert.Same(t, tc.expectDialer.ReturnConn, conn)
					conn.Close()
				} else {
					assert.Nil(t, conn)
				}
			}

			assert.True(t, tc.expectDialer.WasCalled, "Expected dialer %s to be called", tc.expectDialer.Name)
			if tc.expectDialer.WasCalled {
				assert.Equal(t, tc.address, tc.expectDialer.DialedAddr, "Dialed address mismatch")
				assert.Equal(t, ctx, tc.expectDialer.DialedCtx, "Dialed context mismatch")
			}

			allMocks := []*MockPacketDialer{defaultDialer, routeV4Dialer, routeV6Dialer}
			for _, mock := range allMocks {
				if mock != tc.expectDialer {
					assert.False(t, mock.WasCalled, "Dialer %s should NOT have been called", mock.Name)
				}
			}
		})
	}
}
