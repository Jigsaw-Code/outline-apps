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
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseTunnelConfig(t *testing.T) {
	config, err := ParseTunnelConfig(`
transport:
  endpoint:
    host: example.com
    port: 1234
  cipher: chacha20-poly1305
  secret: SECRET`)
	require.NoError(t, err)
	require.Equal(t, &TunnelConfig{
		Transport: &shadowsocksConfig{
			Endpoint: endpointConfig{
				Host: "example.com",
				Port: 1234,
			},
			Cipher: "chacha20-poly1305",
			Secret: "SECRET",
		},
	}, config)
}

func TestParseTunnelConfig_LegacyConfig(t *testing.T) {
	config, err := ParseTunnelConfig(`
  server: example.com
  server_port: 1234
  method: chacha20-poly1305
  password: SECRET`)
	require.NoError(t, err)
	require.Equal(t, &TunnelConfig{
		Transport: &shadowsocksConfig{
			Endpoint: endpointConfig{
				Host: "example.com",
				Port: 1234,
			},
			Cipher: "chacha20-poly1305",
			Secret: "SECRET",
		},
	}, config)
}

func TestParseTunnelConfig_LegacyConfigJSON(t *testing.T) {
	config, err := ParseTunnelConfig(`{
  "server": "example.com",
  "server_port": 1234,
  "method": "chacha20-poly1305",
  "password": "SECRET"
}`)
	require.NoError(t, err)
	require.Equal(t, &TunnelConfig{
		Transport: &shadowsocksConfig{
			Endpoint: endpointConfig{
				Host: "example.com",
				Port: 1234,
			},
			Cipher: "chacha20-poly1305",
			Secret: "SECRET",
		},
	}, config)
}

func TestParseTunnelConfig_Implicit(t *testing.T) {
	config, err := ParseTunnelConfig(`
  endpoint:
    host: example.com
    port: 1234
  cipher: chacha20-poly1305
  secret: SECRET`)
	require.NoError(t, err)
	require.Equal(t, &TunnelConfig{
		Transport: &shadowsocksConfig{
			Endpoint: endpointConfig{
				Host: "example.com",
				Port: 1234,
			},
			Cipher: "chacha20-poly1305",
			Secret: "SECRET",
		},
	}, config)
}

func TestParseTunnelConfig_ShadowsocksURL(t *testing.T) {
	config, err := ParseTunnelConfig("ss://fooof@example.com:1234")
	require.NoError(t, err)
	require.Equal(t, &TunnelConfig{
		Transport: &shadowsocksConfig{
			Endpoint: endpointConfig{
				Host: "example.com",
				Port: 1234,
			},
			Cipher: "chacha20-poly1305",
			Secret: "SECRET",
		},
	}, config)
}

func TestParseTunnelConfig_EmbeddedShadowsocksURL(t *testing.T) {
	config, err := ParseTunnelConfig("transport: ss://fooof@example.com:1234")
	require.NoError(t, err)
	require.Equal(t, &TunnelConfig{
		Transport: &shadowsocksConfig{
			Endpoint: endpointConfig{
				Host: "example.com",
				Port: 1234,
			},
			Cipher: "chacha20-poly1305",
			Secret: "SECRET",
		},
	}, config)
}

func TestParseTunnelConfig_InvalidYAML(t *testing.T) {
	_, err := ParseTunnelConfig("{}:")
	require.ErrorContains(t, err, "tunnel config is not valid YAML")
}

func TestParseTunnelConfig_InvalidTunnelYAMLType(t *testing.T) {
	_, err := ParseTunnelConfig("10")
	require.ErrorContains(t, err, "tunnel config of type int is not supported")
}

func TestParseTunnelConfig_InvalidTransportYAMLType(t *testing.T) {
	_, err := ParseTunnelConfig("transport: 10")
	require.ErrorContains(t, err, "transport config of type int is not supported")
}
