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

package outline

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func Test_NewTransport_SS_URL(t *testing.T) {
	config := "ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpTRUNSRVQ@example.com:4321/"
	firstHop := "example.com:4321"

	result := NewClient(config)
	require.Nil(t, result.Error, "Got %v", result.Error)
	require.Equal(t, firstHop, result.Client.sd.FirstHop)
	require.Equal(t, firstHop, result.Client.pl.FirstHop)
}

func Test_NewTransport_Legacy_JSON(t *testing.T) {
	config := `{
    "server": "example.com",
    "server_port": 4321,
    "method": "chacha20-ietf-poly1305",
    "password": "SECRET"
}`
	firstHop := "example.com:4321"

	result := NewClient(config)
	require.Nil(t, result.Error, "Got %v", result.Error)
	require.Equal(t, firstHop, result.Client.sd.FirstHop)
	require.Equal(t, firstHop, result.Client.pl.FirstHop)
}

func Test_NewTransport_Flexible_JSON(t *testing.T) {
	config := `{
    # Comment
    server: example.com,
    server_port: 4321,
    method: chacha20-ietf-poly1305,
    password: SECRET
}`
	firstHop := "example.com:4321"

	result := NewClient(config)
	require.Nil(t, result.Error, "Got %v", result.Error)
	require.Equal(t, firstHop, result.Client.sd.FirstHop)
	require.Equal(t, firstHop, result.Client.pl.FirstHop)
}

func Test_NewTransport_YAML(t *testing.T) {
	config := `# Comment
server: example.com
server_port: 4321
method: chacha20-ietf-poly1305
password: SECRET`
	firstHop := "example.com:4321"

	result := NewClient(config)
	require.Nil(t, result.Error, "Got %v", result.Error)
	require.Equal(t, firstHop, result.Client.sd.FirstHop)
	require.Equal(t, firstHop, result.Client.pl.FirstHop)
}

func Test_NewTransport_Explicit_endpoint(t *testing.T) {
	config := `
endpoint:
    $parser: dial
    address: example.com:4321
cipher: chacha20-ietf-poly1305
secret: SECRET`
	firstHop := "example.com:4321"

	result := NewClient(config)
	require.Nil(t, result.Error, "Got %v", result.Error)
	require.Equal(t, firstHop, result.Client.sd.FirstHop)
	require.Equal(t, firstHop, result.Client.pl.FirstHop)
}

func Test_NewTransport_Multihop_URL(t *testing.T) {
	config := `
endpoint:
    $parser: dial
    address: exit.example.com:4321
    dialer: ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpTRUNSRVQ@entry.example.com:4321/
cipher: chacha20-ietf-poly1305
secret: SECRET`
	firstHop := "entry.example.com:4321"

	result := NewClient(config)
	require.Nil(t, result.Error, "Got %v", result.Error)
	require.Equal(t, firstHop, result.Client.sd.FirstHop)
	require.Equal(t, firstHop, result.Client.pl.FirstHop)
}

func Test_NewTransport_Multihop_Explicit(t *testing.T) {
	config := `
endpoint:
    $parser: dial
    address: exit.example.com:4321
    dialer: 
      $parser: shadowsocks
      endpoint: entry.example.com:4321
      cipher: chacha20-ietf-poly1305
      secret: ENTRY_SECRET
cipher: chacha20-ietf-poly1305
secret: EXIT_SECRET`
	firstHop := "entry.example.com:4321"

	result := NewClient(config)
	require.Nil(t, result.Error, "Got %v", result.Error)
	require.Equal(t, firstHop, result.Client.sd.FirstHop)
	require.Equal(t, firstHop, result.Client.pl.FirstHop)
}

func Test_NewTransport_Explicit_TCPUDP(t *testing.T) {
	config := `
$parser: tcpudp
tcp:
    $parser: shadowsocks
    endpoint: example.com:80
    cipher: chacha20-ietf-poly1305
    secret: SECRET
    prefix: "POST "
udp:
    $parser: shadowsocks
    endpoint: example.com:53
    cipher: chacha20-ietf-poly1305
    secret: SECRET`

	result := NewClient(config)
	require.Nil(t, result.Error, "Got %v", result.Error)
	require.Equal(t, "example.com:80", result.Client.sd.FirstHop)
	require.Equal(t, "example.com:53", result.Client.pl.FirstHop)
}

func Test_NewTransport_YAML_Reuse(t *testing.T) {
	config := `
$parser: tcpudp
udp: &base
    $parser: shadowsocks
    endpoint: example.com:4321
    cipher: chacha20-ietf-poly1305
    secret: SECRET
tcp:
    <<: *base
    prefix: "POST "`
	firstHop := "example.com:4321"

	result := NewClient(config)
	require.Nil(t, result.Error, "Got %v", result.Error)
	require.Equal(t, firstHop, result.Client.sd.FirstHop)
	require.Equal(t, firstHop, result.Client.pl.FirstHop)
}

func Test_NewTransport_YAML_Partial_Reuse(t *testing.T) {
	config := `
$parser: tcpudp
tcp:
    $parser: shadowsocks
    endpoint: example.com:80
    <<: &cipher
      cipher: chacha20-ietf-poly1305
      secret: SECRET
    prefix: "POST "
udp:
    $parser: shadowsocks
    endpoint: example.com:53
    <<: *cipher`

	result := NewClient(config)
	require.Nil(t, result.Error, "Got %v", result.Error)
	require.Equal(t, "example.com:80", result.Client.sd.FirstHop)
	require.Equal(t, "example.com:53", result.Client.pl.FirstHop)
}

/*
TODO: Add Websocket support
func Test_NewTransport_Websocket(t *testing.T) {
	config := `
$parser: tcpudp
tcp: &base
    $parser: shadowsocks
    endpoint:
        $parser: websocket
        url: https://entrypoint.cdn.example.com/tcp
    cipher: chacha20-ietf-poly1305
    secret: SECRET
udp:
    <<: *base
    endpoint:
        $parser: websocket
        url: https://entrypoint.cdn.example.com/udp`
	firstHop := "entrypoint.cdn.example.com:443"

	result := NewClient(config)
	require.Nil(t, result.Error, "Got %v", result.Error)
	require.Equal(t, firstHop, result.Client.sd.FirstHop)
	require.Equal(t, firstHop, result.Client.pl.FirstHop)
}
*/

func Test_NewClientFromJSON_Errors(t *testing.T) {
	tests := []struct {
		name  string
		input string
	}{
		{
			name:  "missing host",
			input: `{"port":12345,"method":"some-cipher","password":"abcd1234"}`,
		},
		{
			name:  "missing port",
			input: `{"host":"192.0.2.1","method":"some-cipher","password":"abcd1234"}`,
		},
		{
			name:  "missing method",
			input: `{"host":"192.0.2.1","port":12345,"password":"abcd1234"}`,
		},
		{
			name:  "missing password",
			input: `{"host":"192.0.2.1","port":12345,"method":"some-cipher"}`,
		},
		{
			name:  "empty host",
			input: `{"host":"","port":12345,"method":"some-cipher","password":"abcd1234"}`,
		},
		{
			name:  "zero port",
			input: `{"host":"192.0.2.1","port":0,"method":"some-cipher","password":"abcd1234"}`,
		},
		{
			name:  "empty method",
			input: `{"host":"192.0.2.1","port":12345,"method":"","password":"abcd1234"}`,
		},
		{
			name:  "empty password",
			input: `{"host":"192.0.2.1","port":12345,"method":"some-cipher","password":""}`,
		},
		{
			name:  "port -1",
			input: `{"host":"192.0.2.1","port":-1,"method":"some-cipher","password":"abcd1234"}`,
		},
		{
			name:  "port 65536",
			input: `{"host":"192.0.2.1","port":65536,"method":"some-cipher","password":"abcd1234"}`,
		},
		{
			name:  "prefix out-of-range",
			input: `{"host":"192.0.2.1","port":8080,"method":"some-cipher","password":"abcd1234","prefix":"\x1234"}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NewClient(tt.input)
			if got.Error == nil || got.Client != nil {
				t.Errorf("NewClientFromJSON() expects an error, got = %v", got.Client)
				return
			}
		})
	}
}
