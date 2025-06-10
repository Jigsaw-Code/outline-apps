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
	"testing"

	"github.com/Jigsaw-Code/outline-sdk/transport"
	"github.com/stretchr/testify/require"
)

func newTestTransportProvider() *TypeParser[*TransportPair] {
	tcpDialer := &transport.TCPDialer{Dialer: net.Dialer{KeepAlive: -1}}
	udpDialer := &transport.UDPDialer{}
	return NewDefaultTransportProvider(tcpDialer, udpDialer)
}

func TestRegisterDefaultProviders(t *testing.T) {
	provider := newTestTransportProvider()

	node, err := ParseConfigYAML(`
$type: tcpudp
tcp: &shared
  $type: shadowsocks
  endpoint: example.com:1234
  cipher: chacha20-ietf-poly1305
  secret: SECRET
udp: *shared`)
	require.NoError(t, err)

	d, err := provider.Parse(context.Background(), node)
	require.NoError(t, err)

	require.NotNil(t, d.StreamDialer)
	require.NotNil(t, d.PacketListener)
	require.Equal(t, "example.com:1234", d.StreamDialer.FirstHop)
	require.Equal(t, ConnTypeTunneled, d.StreamDialer.ConnType)
	require.Equal(t, "example.com:1234", d.PacketListener.FirstHop)
	require.Equal(t, ConnTypeTunneled, d.PacketListener.ConnType)
}

func TestRegisterParseURL(t *testing.T) {
	provider := newTestTransportProvider()

	node, err := ParseConfigYAML(`ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpaTXJSMW92ZmRBaEQ@example.com:4321/#My%20Server`)
	require.NoError(t, err)

	d, err := provider.Parse(context.Background(), node)
	require.NoError(t, err)

	require.NotNil(t, d.StreamDialer)
	require.NotNil(t, d.PacketListener)
	require.Equal(t, "example.com:4321", d.StreamDialer.FirstHop)
	require.Equal(t, ConnTypeTunneled, d.StreamDialer.ConnType)
	require.Equal(t, "example.com:4321", d.PacketListener.FirstHop)
	require.Equal(t, ConnTypeTunneled, d.PacketListener.ConnType)
}

func TestRegisterParseURLInQuotes(t *testing.T) {
	provider := newTestTransportProvider()

	node, err := ParseConfigYAML(`"ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpaTXJSMW92ZmRBaEQ@example.com:4321/#My%20Server"`)
	require.NoError(t, err)

	d, err := provider.Parse(context.Background(), node)
	require.NoError(t, err)

	require.NotNil(t, d.StreamDialer)
	require.NotNil(t, d.PacketListener)
	require.Equal(t, "example.com:4321", d.StreamDialer.FirstHop)
	require.Equal(t, ConnTypeTunneled, d.StreamDialer.ConnType)
	require.Equal(t, "example.com:4321", d.PacketListener.FirstHop)
	require.Equal(t, ConnTypeTunneled, d.PacketListener.ConnType)
}

type mockStreamDialer struct {
	name string
	transport.StreamDialer
}

func (d *mockStreamDialer) DialStream(ctx context.Context, addr string) (transport.StreamConn, error) {
	return nil, errors.New("dialed by mock: " + d.name)
}

func TestParseIPTableTCP(t *testing.T) {
	tp := NewDefaultTransportProvider(
		&mockStreamDialer{name: "default-tcp"},
		nil, // UDP transport not under test.
	)

	// Define our config with an ip-table for the TCP transport.
	// We'll have one IP route to a "proxy" (which is a mock dialer)
	// and a default route to "direct" (also a mock).
	yamlConfig := `
$type: tcpudp
tcp:
  $type: ip-table
  table:
    - ip: 192.168.1.128
      dialer:
        $type: shadowsocks
        config: "ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTp0ZXN0@example.com:443#proxy"

    - ip: 2001:db8:1:1::/64
      dialer:
        $type: shadowsocks
        config: "ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTp0ZXN0@example.com:443#proxy"

    - dialer:
        $type: direct
udp:
	$type: direct
`
	transportPair, err := tp.Parse(context.Background(), yamlConfig)
	require.NoError(t, err)
	require.NotNil(t, transportPair.StreamDialer, "StreamDialer should be configured")

	_, err = transportPair.DialStream(context.Background(), "192.168.1.128:12345")
	require.Error(t, err)
	require.Contains(t, err.Error(), "dialed by mock: default-tcp", "Traffic to proxy IP should use the default mock dialer via shadowsocks config")

	_, err = transportPair.DialStream(context.Background(), "8.8.8.8:53")
	require.Error(t, err)
	require.Contains(t, err.Error(), "dialed by mock: default-tcp", "Traffic to other IPs should use the default mock dialer")

	_, err = transportPair.DialStream(context.Background(), "[2001:db8:1:1::a:b]:443")
	require.Error(t, err)
	require.Contains(t, err.Error(), "dialed by mock: default-tcp", "Traffic to proxy IPv6 should use the default mock dialer")
}
