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
	"net"
	"net/netip"
	"sync"
	"testing"
	"time"

	"github.com/Jigsaw-Code/outline-sdk/transport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIPTablePacketListener_New(t *testing.T) {
	_, err := NewIPTablePacketListener(nil, nil)
	require.Error(t, err, "NewIPTablePacketListener should have returned an error for nil default listener")

	mockListener := &mockPacketListener{conn: newMockPacketConn(t, "0.0.0.0", "0.0.0.0")}
	_, err = NewIPTablePacketListener(nil, mockListener)
	require.NoError(t, err, "NewIPTablePacketListener returned an unexpected error with a valid mock default listener")
}

type mockPacketConn struct {
	readChan  chan []byte
	writeChan chan []byte
	closeOnce sync.Once
	closed    chan struct{}
	addr      net.Addr
	localAddr net.Addr
}

func newMockPacketConn(t *testing.T, remoteAddrStr string, localAddrStr string) *mockPacketConn {
	t.Helper()
	remoteIP := net.ParseIP(remoteAddrStr)
	require.NotNil(t, remoteIP, "Failed to parse remote IP: %s", remoteAddrStr)

	var localUDPAddr *net.UDPAddr
	if localAddrStr != "" {
		parsedLocalIP := net.ParseIP(localAddrStr)
		require.NotNil(t, parsedLocalIP, "Failed to parse local IP: %s", localAddrStr)
		localUDPAddr = &net.UDPAddr{IP: parsedLocalIP, Port: 54321}
	} else {
		localUDPAddr = &net.UDPAddr{IP: net.IPv4zero, Port: 54321}
	}

	return &mockPacketConn{
		readChan:  make(chan []byte, 10),
		writeChan: make(chan []byte, 10),
		closed:    make(chan struct{}),
		addr:      &net.UDPAddr{IP: remoteIP, Port: 12345},
		localAddr: localUDPAddr,
	}
}

var errConnectionClosed = errors.New("connection closed")

func (m *mockPacketConn) ReadFrom(p []byte) (n int, addr net.Addr, err error) {
	select {
	case data := <-m.readChan:
		n = copy(p, data)
		return n, m.addr, nil
	case <-m.closed:
		return 0, nil, errConnectionClosed
	}
}

func (m *mockPacketConn) WriteTo(p []byte, addr net.Addr) (n int, err error) {
	select {
	case m.writeChan <- p:
		return len(p), nil
	case <-m.closed:
		return 0, errConnectionClosed
	}
}

func (m *mockPacketConn) Close() error {
	m.closeOnce.Do(func() {
		close(m.closed)
	})
	return nil
}

func (m *mockPacketConn) LocalAddr() net.Addr {
	return &net.UDPAddr{IP: net.IPv4zero, Port: 0} // Dummy
}

func (m *mockPacketConn) SetDeadline(t time.Time) error {
	// TODO: Implement if deadline testing is needed for the mock.
	return nil
}

func (m *mockPacketConn) SetReadDeadline(t time.Time) error {
	// TODO: Implement if deadline testing is needed for the mock.
	return nil
}

func (m *mockPacketConn) SetWriteDeadline(t time.Time) error {
	// TODO: Implement if deadline testing is needed for the mock.
	return nil
}

type mockPacketListener struct {
	conn net.PacketConn
}

func (m *mockPacketListener) ListenPacket(ctx context.Context) (net.PacketConn, error) {
	if m.conn == nil {
		return nil, errors.New("mockPacketListener has no connection configured")
	}
	return m.conn, nil
}

func TestIPTablePacketListener_ListenPacket(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second) // Overall test timeout
	defer cancel()

	// Setup: Create a listener with a table and default listener
	table := NewIPTable[transport.PacketListener]()

	mockConn1 := newMockPacketConn(t, "1.2.3.4", "127.0.0.1")
	mockConn2 := newMockPacketConn(t, "5.6.7.8", "127.0.0.1")
	mockConnDefault := newMockPacketConn(t, "10.0.0.1", "127.0.0.1")

	// Use AddPrefix as defined in the IPTable interface
	require.NoError(t, table.AddPrefix(netip.MustParsePrefix("1.2.3.0/24"), &mockPacketListener{conn: mockConn1}))
	require.NoError(t, table.AddPrefix(netip.MustParsePrefix("5.6.7.0/24"), &mockPacketListener{conn: mockConn2}))

	defaultListener := &mockPacketListener{conn: mockConnDefault}

	iptableListener, err := NewIPTablePacketListener(table, defaultListener)
	require.NoError(t, err, "NewIPTablePacketListener failed")

	// Test: Get a PacketConn from the IPTablePacketListener
	conn, err := iptableListener.ListenPacket(ctx)
	require.NoError(t, err, "ListenPacket failed")
	defer conn.Close()

	// Test: Write to connections via IPTable
	testData := []byte("test packet")
	dest1AddrStr := "1.2.3.100:12345"
	dest2AddrStr := "5.6.7.100:12345"
	destDefaultAddrStr := "9.8.7.6:12345"

	dest1, err := net.ResolveUDPAddr("udp", dest1AddrStr)
	require.NoError(t, err, "Failed to resolve dest1")
	dest2, err := net.ResolveUDPAddr("udp", dest2AddrStr)
	require.NoError(t, err, "Failed to resolve dest2")
	destDefault, err := net.ResolveUDPAddr("udp", destDefaultAddrStr)
	require.NoError(t, err, "Failed to resolve destDefault")

	// Write to specific listener 1
	_, err = conn.WriteTo(testData, dest1)
	require.NoError(t, err, "WriteTo to dest1 failed")
	select {
	case received := <-mockConn1.writeChan:
		assert.Equal(t, testData, received, "mockConn1 received unexpected data")
	case <-time.After(100 * time.Millisecond): // Shorter timeout for individual ops
		t.Fatal("mockConn1 did not receive data")
	}

	// Write to specific listener 2
	_, err = conn.WriteTo(testData, dest2)
	require.NoError(t, err, "WriteTo to dest2 failed")
	select {
	case received := <-mockConn2.writeChan:
		assert.Equal(t, testData, received, "mockConn2 received unexpected data")
	case <-time.After(100 * time.Millisecond):
		t.Fatal("mockConn2 did not receive data")
	}

	// Write to default listener
	_, err = conn.WriteTo(testData, destDefault)
	require.NoError(t, err, "WriteTo to destDefault failed")
	select {
	case received := <-mockConnDefault.writeChan:
		assert.Equal(t, testData, received, "default listener (mockConnDefault) received unexpected data")
	case <-time.After(100 * time.Millisecond):
		t.Fatal("default listener (mockConnDefault) did not receive data")
	}

	// Test: Read from connections
	packetFrom1 := []byte("response from 1.2.3.4")
	packetFrom2 := []byte("response from 5.6.7.8")
	packetFromDefault := []byte("response from 10.0.0.1")

	mockConn1.readChan <- packetFrom1
	mockConn2.readChan <- packetFrom2
	mockConnDefault.readChan <- packetFromDefault

	expectedResponses := map[string][]byte{
		mockConn1.addr.String():       packetFrom1,
		mockConn2.addr.String():       packetFrom2,
		mockConnDefault.addr.String(): packetFromDefault,
	}
	receivedResponses := make(map[string][]byte)

	readBuf := make([]byte, 1024)
	for i := 0; i < len(expectedResponses); i++ {
		n, addr, readErr := conn.ReadFrom(readBuf)
		// Check for context timeout or other fatal errors
		if ctx.Err() != nil {
			t.Fatalf("Context timed out while waiting for ReadFrom: %v", ctx.Err())
		}
		require.NoError(t, readErr, "ReadFrom failed on iteration %d", i)

		responseBytes := make([]byte, n)
		copy(responseBytes, readBuf[:n])
		receivedResponses[addr.String()] = responseBytes
	}

	assert.Equal(t, expectedResponses, receivedResponses, "Mismatch in received responses")

	// Test SetDefault to nil and try writing (should fail if IP not in table)
	iptableListener.SetDefault(nil)
	conn2, err := iptableListener.ListenPacket(ctx) // iptableListener now has nil default
	require.NoError(t, err, "ListenPacket (conn2) failed")
	defer conn2.Close()

	_, err = conn2.WriteTo(testData, destDefault) // Should use the new nil default listener
	require.Error(t, err, "conn2.WriteTo to destDefault should fail as default listener is nil")
	t.Logf("Error from WriteTo with nil default: %v", err)

	// Test writing to an address that IS in the table, should still work
	_, err = conn2.WriteTo(testData, dest1)
	require.NoError(t, err, "conn2.WriteTo to dest1 should still work")
	select {
	case received := <-mockConn1.writeChan:
		assert.Equal(t, testData, received, "mockConn1 (via conn2) received unexpected data")
	case <-time.After(100 * time.Millisecond):
		t.Fatal("mockConn1 (via conn2) did not receive data after SetDefault(nil)")
	}
}

func TestIPTablePacketListener_IPv4IPv6Routing(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	table := NewIPTable[transport.PacketListener]()

	mockConnV4Specific := newMockPacketConn(t, "192.0.2.1", "127.0.0.1")
	mockConnV6Specific := newMockPacketConn(t, "2001:db8:1::1", "::1")
	mockConnDefault := newMockPacketConn(t, "10.0.0.1", "127.0.0.1")

	require.NoError(t, table.AddPrefix(netip.MustParsePrefix("192.0.2.0/24"), &mockPacketListener{conn: mockConnV4Specific}))
	require.NoError(t, table.AddPrefix(netip.MustParsePrefix("2001:db8:1::/48"), &mockPacketListener{conn: mockConnV6Specific}))

	defaultListener := &mockPacketListener{conn: mockConnDefault}
	iptableListener, err := NewIPTablePacketListener(table, defaultListener)
	require.NoError(t, err, "NewIPTablePacketListener failed")

	conn, err := iptableListener.ListenPacket(ctx)
	require.NoError(t, err, "ListenPacket failed")
	defer conn.Close()

	testData := []byte("ipv4-ipv6-test")

	// 1. IPv4
	destV4PureAddrStr := "192.0.2.100:12345"
	destV4Pure, err := net.ResolveUDPAddr("udp4", destV4PureAddrStr) // Force IPv4
	require.NoError(t, err, "Failed to resolve destV4Pure")

	_, err = conn.WriteTo(testData, destV4Pure)
	require.NoError(t, err, "WriteTo to destV4Pure failed")
	select {
	case received := <-mockConnV4Specific.writeChan:
		assert.Equal(t, testData, received, "mockConnV4Specific received unexpected data for pure IPv4")
	case <-time.After(100 * time.Millisecond):
		t.Fatal("mockConnV4Specific did not receive data for pure IPv4")
	}

	// 2. IPv6
	destV6PureAddrStr := "[2001:db8:1::100]:12345"
	destV6Pure, err := net.ResolveUDPAddr("udp6", destV6PureAddrStr) // Force IPv6
	require.NoError(t, err, "Failed to resolve destV6Pure")

	_, err = conn.WriteTo(testData, destV6Pure)
	require.NoError(t, err, "WriteTo to destV6Pure failed")
	select {
	case received := <-mockConnV6Specific.writeChan:
		assert.Equal(t, testData, received, "mockConnV6Specific received unexpected data for pure IPv6")
	case <-time.After(100 * time.Millisecond):
		t.Fatal("mockConnV6Specific did not receive data for pure IPv6")
	}
}
