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
	"net"
	"testing"

	"github.com/Jigsaw-Code/outline-apps/client/go/configyaml"
	"github.com/Jigsaw-Code/outline-sdk/transport"
	"github.com/stretchr/testify/require"
)

func newTestProxylessProvider() *configyaml.TypeParser[*TransportPair] {
	tcpDialer := &transport.TCPDialer{Dialer: net.Dialer{KeepAlive: -1}}
	udpDialer := &transport.UDPDialer{}
	return NewDefaultTransportProvider(tcpDialer, udpDialer)
}

func TestParseProxyless(t *testing.T) {
	provider := newTestProxylessProvider()

	node, err := configyaml.ParseConfigYAML(`
tcp:
  $type: basic-access
  dns_resolvers:
    - $type: https
      address: https://dns.google/dns-query
    - $type: https
      address: https://dns.quad9.net/dns-query
`)

	require.NoError(t, err)

	transportPair, err := provider.Parse(context.Background(), node)
	require.NoError(t, err)
	require.NotNil(t, transportPair)
	require.NotNil(t, transportPair.StreamDialer)
	require.Equal(t, ConnTypeDirect, transportPair.StreamDialer.ConnType)
}
