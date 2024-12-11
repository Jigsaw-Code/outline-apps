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

/*
func TestParseTunnelConfig(t *testing.T) {
	config, err := ParseTunnelConfig(`
transport:
  endpoint: {address: example.com:1234}
  cipher: chacha20-ietf-poly1305
  secret: SECRET`)
	require.NoError(t, err)
	require.Equal(t, &TunnelConfig{
		Transport: &shadowsocksConfig{
			Endpoint: DialEndpointConfig{Address: "example.com:1234"},
			Cipher:   "chacha20-ietf-poly1305",
			Secret:   "SECRET",
		},
	}, config)
}

func TestParseTunnelConfig_LegacyConfig(t *testing.T) {
	config, err := ParseTunnelConfig(`
  server: example.com
  server_port: 1234
  method: chacha20-ietf-poly1305
  password: SECRET`)
	require.NoError(t, err)
	require.Equal(t, &TunnelConfig{
		Transport: &shadowsocksConfig{
			Endpoint: DialEndpointConfig{Address: "example.com:1234"},
			Cipher:   "chacha20-ietf-poly1305",
			Secret:   "SECRET",
		},
	}, config)
}

func TestParseTunnelConfig_LegacyConfigJSON(t *testing.T) {
	config, err := ParseTunnelConfig(`{
  "server": "example.com",
  "server_port": 1234,
  "method": "chacha20-ietf-poly1305",
  "password": "SECRET"
}`)
	require.NoError(t, err)
	require.Equal(t, &TunnelConfig{
		Transport: &shadowsocksConfig{
			Endpoint: DialEndpointConfig{Address: "example.com:1234"},
			Cipher:   "chacha20-ietf-poly1305",
			Secret:   "SECRET",
		},
	}, config)
}

func TestParseTunnelConfig_Implicit(t *testing.T) {
	config, err := ParseTunnelConfig(`
  endpoint: example.com:1234
  cipher: chacha20-ietf-poly1305
  secret: SECRET`)
	require.NoError(t, err)
	require.Equal(t, &TunnelConfig{
		Transport: &shadowsocksConfig{
			Endpoint: DialEndpointConfig{Address: "example.com:1234"},
			Cipher:   "chacha20-ietf-poly1305",
			Secret:   "SECRET",
		},
	}, config)
}

func TestParseTunnelConfig_ShadowsocksURL(t *testing.T) {
	config, err := ParseTunnelConfig("ss://fooof@example.com:1234")
	require.NoError(t, err)
	require.Equal(t, &TunnelConfig{
		Transport: &shadowsocksConfig{
			Endpoint: DialEndpointConfig{Address: "example.com:1234"},
			Cipher:   "chacha20-ietf-poly1305",
			Secret:   "SECRET",
		},
	}, config)
}

func TestParseTunnelConfig_ShortEndpoint(t *testing.T) {
	config, err := ParseTunnelConfig(`
transport:
  endpoint: example.com:1234
  cipher: chacha20-ietf-poly1305
  secret: SECRET`)
	require.NoError(t, err)
	require.Equal(t, &TunnelConfig{
		Transport: &shadowsocksConfig{
			Endpoint: DialEndpointConfig{Address: "example.com:1234"},
			Cipher:   "chacha20-ietf-poly1305",
			Secret:   "SECRET",
		},
	}, config)
}

func TestParseTunnelConfig_EmbeddedShadowsocksURL(t *testing.T) {
	config, err := ParseTunnelConfig("transport: ss://fooof@example.com:1234")
	require.NoError(t, err)
	require.Equal(t, &TunnelConfig{
		Transport: &shadowsocksConfig{
			Endpoint: DialEndpointConfig{Address: "example.com:1234"},
			Cipher:   "chacha20-ietf-poly1305",
			Secret:   "SECRET",
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

*/

func Test_parseConfigFromJSON(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    *ShadowsocksConfig
		wantErr bool
	}{
		{
			name:  "normal config",
			input: `{"server":"192.0.2.1","server_port":12345,"method":"chacha20-ietf-poly1305","password":"abcd1234"}`,
			want: &ShadowsocksConfig{
				Endpoint: "192.0.2.1:12345",
				Cipher:   "chacha20-ietf-poly1305",
				Secret:   "abcd1234",
				Prefix:   "",
			},
		},
		{
			name:  "normal config with prefix",
			input: `{"server":"192.0.2.1","server_port":12345,"method":"chacha20-ietf-poly1305","password":"abcd1234","prefix":"abc 123"}`,
			want: &ShadowsocksConfig{
				Endpoint: "192.0.2.1:12345",
				Cipher:   "chacha20-ietf-poly1305",
				Secret:   "abcd1234",
				Prefix:   "abc 123",
			},
		},
		{
			name:    "normal config with extra fields",
			input:   `{"extra_field":"error","server":"192.0.2.1","server_port":12345,"method":"chacha20-ietf-poly1305","password":"abcd1234"}`,
			wantErr: true,
		},
		{
			name:  "unprintable prefix",
			input: `{"server":"192.0.2.1","server_port":12345,"method":"chacha20-ietf-poly1305","password":"abcd1234","prefix":"\u0000\u0080\u00ff"}`,
			want: &ShadowsocksConfig{
				Endpoint: "192.0.2.1:12345",
				Cipher:   "chacha20-ietf-poly1305",
				Secret:   "abcd1234",
				Prefix:   "\u0000\u0080\u00ff",
			},
		},
		{
			name:  "multi-byte utf-8 prefix",
			input: `{"server":"192.0.2.1","server_port":12345,"method":"chacha20-ietf-poly1305","password":"abcd1234","prefix":"\u0080\u0081\u00fd\u00ff"}`,
			want: &ShadowsocksConfig{
				Endpoint: "192.0.2.1:12345",
				Cipher:   "chacha20-ietf-poly1305",
				Secret:   "abcd1234",
				Prefix:   "\u0080\u0081\u00fd\u00ff",
			},
		},
		// TODO(fortuna): Move these to the endpoint tests.
		{
			name:    "missing host",
			input:   `{"server_port":12345,"method":"chacha20-ietf-poly1305","password":"abcd1234"}`,
			wantErr: true,
		},
		// TODO: validate port
		// {
		// 	name:    "missing port",
		// 	input:   `{"server":"192.0.2.1","method":"chacha20-ietf-poly1305","password":"abcd1234"}`,
		// 	wantErr: true,
		// },
		{
			name:    "missing method",
			input:   `{"server":"192.0.2.1","server_port":12345,"password":"abcd1234"}`,
			wantErr: true,
		},
		{
			name:    "missing password",
			input:   `{"server":"192.0.2.1","server_port":12345,"method":"chacha20-ietf-poly1305"}`,
			wantErr: true,
		},
		// TODO: validate host
		// {
		// 	name:    "empty host",
		// 	input:   `{"server":"","server_port":12345,"method":"chacha20-ietf-poly1305","password":"abcd1234"}`,
		// 	wantErr: true,
		// },
		// TODO: validate port
		// {
		// 	name:    "zero port",
		// 	input:   `{"server":"192.0.2.1","server_port":0,"method":"chacha20-ietf-poly1305","password":"abcd1234"}`,
		// 	wantErr: true,
		// },
		{
			name:    "empty method",
			input:   `{"server":"192.0.2.1","server_port":12345,"method":"","password":"abcd1234"}`,
			wantErr: true,
		},
		{
			name:    "unsupported",
			input:   `{"server":"192.0.2.1","server_port":12345,"method":"unsupported","password":""}`,
			wantErr: true,
		},
		{
			name:    "empty password",
			input:   `{"server":"192.0.2.1","server_port":12345,"method":"chacha20-ietf-poly1305","password":""}`,
			wantErr: true,
		},
		{
			name:  "empty prefix",
			input: `{"server":"192.0.2.1","server_port":12345,"method":"chacha20-ietf-poly1305","password":"abcd1234","prefix":""}`,
			want: &ShadowsocksConfig{
				Endpoint: "192.0.2.1:12345",
				Cipher:   "chacha20-ietf-poly1305",
				Secret:   "abcd1234",
				Prefix:   "",
			},
		},
		{
			name:    "prefix out-of-range",
			input:   `{"server":"192.0.2.1","server_port":8080,"method":"chacha20-ietf-poly1305","password":"abcd1234","prefix":"\u1234"}`,
			wantErr: true,
		},
		{
			name:    "port -1",
			input:   `{"server":"192.0.2.1","server_port":-1,"method":"chacha20-ietf-poly1305","password":"abcd1234"}`,
			wantErr: true,
		},
		{
			name:    "port 65536",
			input:   `{"server":"192.0.2.1","server_port":65536,"method":"chacha20-ietf-poly1305","password":"abcd1234"}`,
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node, err := ParseConfigYAML(tt.input)
			require.NoError(t, err)
			got, err := parseShadowsocksConfig(node)
			if err == nil {
				_, err = newShadowsocksParams(node)
			}
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}
