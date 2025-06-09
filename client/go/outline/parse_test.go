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

package outline

import (
	"encoding/json"
	"testing"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/stretchr/testify/require"
)

// parsedTunnelResultJSON is a helper struct to unmarshal the JSON output of doParseTunnelConfig.
type parsedTunnelResultJSON struct {
	Client   string `json:"client"`
	FirstHop string `json:"firstHop"`
}

func parseFirstHopAndTunnelConfigJSON(t *testing.T, jsonStr string) parsedTunnelResultJSON {
	t.Helper()
	var parsed parsedTunnelResultJSON
	err := json.Unmarshal([]byte(jsonStr), &parsed)
	require.NoError(t, err, "Failed to unmarshal JSON output from doParseTunnelConfig: %s", jsonStr)
	return parsed
}

func Test_doParseTunnel_SSURL(t *testing.T) {
	result := doParseTunnelConfig("ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpTRUNSRVQ@example.com:4321/")
	require.Nil(t, result.Error)
	require.Equal(t,
		"{\"client\":\"{transport: \\\"ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpTRUNSRVQ@example.com:4321/\\\"}\\n\",\"firstHop\":\"example.com:4321\"}",
		result.Value)
}

func Test_doParseTunnel_SSURL_With_Comment(t *testing.T) {
	result := doParseTunnelConfig("# Comment\nss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpTRUNSRVQ@example.com:4321/")
	require.Nil(t, result.Error)
	require.Equal(t,
		"{\"client\":\"{transport: \\\"ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpTRUNSRVQ@example.com:4321/\\\"}\\n\",\"firstHop\":\"example.com:4321\"}",
		result.Value)
}

func Test_doParseTunnel_LegacyJSON(t *testing.T) {
	result := doParseTunnelConfig(`{
    "server": "example.com",
    "server_port": 4321,
    "method": "chacha20-ietf-poly1305",
    "password": "SECRET"
}`)
	require.Nil(t, result.Error)
	require.Equal(t,
		"{\"client\":\"{transport: {method: chacha20-ietf-poly1305, password: SECRET, server: example.com, server_port: 4321}}\\n\",\"firstHop\":\"example.com:4321\"}",
		result.Value)
}

func Test_doParseTunnelConfig(t *testing.T) {
	result := doParseTunnelConfig(`
transport:
  $type: tcpudp
  tcp: &shared
    $type: shadowsocks
    endpoint: example.com:80
    cipher: chacha20-ietf-poly1305
    secret: SECRET
  udp: *shared`)

	require.Nil(t, result.Error)
	require.Equal(t,
		"{\"client\":\"{transport: {$type: tcpudp, tcp: {$type: shadowsocks, cipher: chacha20-ietf-poly1305, endpoint: \\\"example.com:80\\\", secret: SECRET}, udp: {$type: shadowsocks, cipher: chacha20-ietf-poly1305, endpoint: \\\"example.com:80\\\", secret: SECRET}}}\\n\",\"firstHop\":\"example.com:80\"}",
		result.Value)
}

func Test_doParseTunnelConfig_ProviderError(t *testing.T) {
	result := doParseTunnelConfig(`
error:
  message: Unauthorized
  details: Account expired
`)

	require.Equal(t, result.Error, &platerrors.PlatformError{
		Code:    platerrors.ProviderError,
		Message: "Unauthorized",
		Details: map[string]any{
			"details": "Account expired",
		},
	})
}

func Test_doParseTunnelConfig_ProviderErrorJSON(t *testing.T) {
	result := doParseTunnelConfig(`
{
  "error": {
    "message": "\u26a0 Invalid Access Key \/ Key \u1000\u102d\u102f\u1015\u103c\u1014\u103a\u101c\u100a\u103a\u1005\u1005\u103a\u1006\u1031\u1038\u1015\u1031\u1038\u1015\u102b\u104b",
    "details": "\u26a0 Details \/ Key \u1000\u102d\u102f\u1015\u103c\u1014\u103a\u101c\u100a\u103a\u1005\u1005\u103a\u1006\u1031\u1038\u1015\u1031\u1038\u1015\u102b\u104b"
  }
}`)

	require.Equal(t, &platerrors.PlatformError{
		Code:    platerrors.ProviderError,
		Message: "⚠ Invalid Access Key / Key ကိုပြန်လည်စစ်ဆေးပေးပါ။",
		Details: map[string]any{
			"details": "⚠ Details / Key ကိုပြန်လည်စစ်ဆေးပေးပါ။",
		},
	}, result.Error)
}

func TestParseConfig_SS_URL(t *testing.T) {
	userInputConfig := "ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpTRUNSRVQ@example.com:4321/"
	expectedFirstHop := "example.com:4321"

	result := doParseTunnelConfig(userInputConfig)
	require.Nil(t, result.Error, "doParseTunnelConfig failed: %v", result.Error)

	parsedOutput := parseFirstHopAndTunnelConfigJSON(t, result.Value)
	require.Equal(t, expectedFirstHop, parsedOutput.FirstHop)

	clientResult := NewClient(parsedOutput.Client)
	require.Nil(t, clientResult.Error, "NewClient failed with parsed client config: %v", clientResult.Error)
	require.NotNil(t, clientResult.Client)
	require.Equal(t, expectedFirstHop, clientResult.Client.sd.FirstHop)
	require.Equal(t, expectedFirstHop, clientResult.Client.pl.FirstHop)
}

func TestParseConfig_Legacy_JSON(t *testing.T) {
	userInputConfig := `{
    "server": "example.com",
    "server_port": 4321,
    "method": "chacha20-ietf-poly1305",
    "password": "SECRET"
}`
	expectedFirstHop := "example.com:4321"

	result := doParseTunnelConfig(userInputConfig)
	require.Nil(t, result.Error, "doParseTunnelConfig failed: %v", result.Error)

	parsedOutput := parseFirstHopAndTunnelConfigJSON(t, result.Value)
	require.Equal(t, expectedFirstHop, parsedOutput.FirstHop)

	clientResult := NewClient(parsedOutput.Client)
	require.Nil(t, clientResult.Error, "NewClient failed with parsed client config: %v", clientResult.Error)
	require.NotNil(t, clientResult.Client)
	require.Equal(t, expectedFirstHop, clientResult.Client.sd.FirstHop)
	require.Equal(t, expectedFirstHop, clientResult.Client.pl.FirstHop)
}

func TestParseConfig_Flexible_JSON(t *testing.T) {
	userInputConfig := `{
    # Comment
    server: example.com,
    server_port: 4321,
    method: chacha20-ietf-poly1305,
    password: SECRET
}`
	expectedFirstHop := "example.com:4321"

	result := doParseTunnelConfig(userInputConfig)
	require.Nil(t, result.Error, "doParseTunnelConfig failed: %v", result.Error)

	parsedOutput := parseFirstHopAndTunnelConfigJSON(t, result.Value)
	require.Equal(t, expectedFirstHop, parsedOutput.FirstHop)

	clientResult := NewClient(parsedOutput.Client)
	require.Nil(t, clientResult.Error, "NewClient failed with parsed client config: %v", clientResult.Error)
	require.NotNil(t, clientResult.Client)
	require.Equal(t, expectedFirstHop, clientResult.Client.sd.FirstHop)
	require.Equal(t, expectedFirstHop, clientResult.Client.pl.FirstHop)
}

func TestParseConfig_Transport_YAML(t *testing.T) {
	// This input is the transport part of a ClientConfig.
	// doParseTunnelConfig will treat it as a "legacy" format and wrap it.
	userInputConfig := `# Comment
server: example.com
server_port: 4321
method: chacha20-ietf-poly1305
password: SECRET`
	expectedFirstHop := "example.com:4321"

	result := doParseTunnelConfig(userInputConfig)
	require.Nil(t, result.Error, "doParseTunnelConfig failed: %v", result.Error)

	parsedOutput := parseFirstHopAndTunnelConfigJSON(t, result.Value)
	require.Equal(t, expectedFirstHop, parsedOutput.FirstHop)

	clientResult := NewClient(parsedOutput.Client)
	require.Nil(t, clientResult.Error, "NewClient failed with parsed client config: %v", clientResult.Error)
	require.NotNil(t, clientResult.Client)
	require.Equal(t, expectedFirstHop, clientResult.Client.sd.FirstHop)
	require.Equal(t, expectedFirstHop, clientResult.Client.pl.FirstHop)
}

func TestParseConfig_Transport_Explicit_Endpoint(t *testing.T) {
	userInputConfig := `
endpoint:
    $type: dial
    address: example.com:4321
cipher: chacha20-ietf-poly1305
secret: SECRET`
	expectedFirstHop := "example.com:4321"

	result := doParseTunnelConfig(userInputConfig)
	require.Nil(t, result.Error, "doParseTunnelConfig failed: %v", result.Error)

	parsedOutput := parseFirstHopAndTunnelConfigJSON(t, result.Value)
	require.Equal(t, expectedFirstHop, parsedOutput.FirstHop)

	clientResult := NewClient(parsedOutput.Client)
	require.Nil(t, clientResult.Error, "NewClient failed with parsed client config: %v", clientResult.Error)
	require.NotNil(t, clientResult.Client)
	require.Equal(t, expectedFirstHop, clientResult.Client.sd.FirstHop)
	require.Equal(t, expectedFirstHop, clientResult.Client.pl.FirstHop)
}

func TestParseConfig_Transport_Multihop_URL(t *testing.T) {
	userInputConfig := `
endpoint:
    $type: dial
    address: exit.example.com:4321
    dialer: ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpTRUNSRVQ@entry.example.com:4321/
cipher: chacha20-ietf-poly1305
secret: SECRET`
	expectedFirstHop := "entry.example.com:4321"

	result := doParseTunnelConfig(userInputConfig)
	require.Nil(t, result.Error, "doParseTunnelConfig failed: %v", result.Error)

	parsedOutput := parseFirstHopAndTunnelConfigJSON(t, result.Value)
	require.Equal(t, expectedFirstHop, parsedOutput.FirstHop)

	clientResult := NewClient(parsedOutput.Client)
	require.Nil(t, clientResult.Error, "NewClient failed with parsed client config: %v", clientResult.Error)
	require.NotNil(t, clientResult.Client)
	require.Equal(t, expectedFirstHop, clientResult.Client.sd.FirstHop)
	require.Equal(t, expectedFirstHop, clientResult.Client.pl.FirstHop)
}

func TestParseConfig_Transport_Multihop_Explicit(t *testing.T) {
	userInputConfig := `
endpoint:
    $type: dial
    address: exit.example.com:4321
    dialer: 
      $type: shadowsocks
      endpoint: entry.example.com:4321
      cipher: chacha20-ietf-poly1305
      secret: ENTRY_SECRET
cipher: chacha20-ietf-poly1305
secret: EXIT_SECRET`
	expectedFirstHop := "entry.example.com:4321"

	result := doParseTunnelConfig(userInputConfig)
	require.Nil(t, result.Error, "doParseTunnelConfig failed: %v", result.Error)

	parsedOutput := parseFirstHopAndTunnelConfigJSON(t, result.Value)
	require.Equal(t, expectedFirstHop, parsedOutput.FirstHop)

	clientResult := NewClient(parsedOutput.Client)
	require.Nil(t, clientResult.Error, "NewClient failed with parsed client config: %v", clientResult.Error)
	require.NotNil(t, clientResult.Client)
	require.Equal(t, expectedFirstHop, clientResult.Client.sd.FirstHop)
	require.Equal(t, expectedFirstHop, clientResult.Client.pl.FirstHop)
}

func TestParseConfig_Transport_Explicit_TCPUDP(t *testing.T) {
	userInputConfig := `
$type: tcpudp
tcp:
    $type: shadowsocks
    endpoint: example.com:80
    cipher: chacha20-ietf-poly1305
    secret: SECRET
    prefix: "POST "
udp:
    $type: shadowsocks
    endpoint: example.com:53
    cipher: chacha20-ietf-poly1305
    secret: SECRET`
	expectedSdFirstHop := "example.com:80"
	expectedPlFirstHop := "example.com:53"

	result := doParseTunnelConfig(userInputConfig)
	require.Nil(t, result.Error, "doParseTunnelConfig failed: %v", result.Error)

	parsedOutput := parseFirstHopAndTunnelConfigJSON(t, result.Value)
	// FirstHop in JSON output will be empty because sd and pl hops are different
	require.Empty(t, parsedOutput.FirstHop)

	clientResult := NewClient(parsedOutput.Client)
	require.Nil(t, clientResult.Error, "NewClient failed with parsed client config: %v", clientResult.Error)
	require.NotNil(t, clientResult.Client)
	require.Equal(t, expectedSdFirstHop, clientResult.Client.sd.FirstHop)
	require.Equal(t, expectedPlFirstHop, clientResult.Client.pl.FirstHop)
}

func TestParseConfig_Transport_Unsupported(t *testing.T) {
	userInputConfig := `$type: unsupported` // This is a transport config
	result := doParseTunnelConfig(userInputConfig)
	require.NotNil(t, result.Error, "Expected an error for unsupported config")
	require.Equal(t, platerrors.InvalidConfig, result.Error.Code)
	// The message comes from NewClient's error wrapping
	require.Contains(t, result.Error.Message, "unsupported config")
}

func TestParseConfig_Transport_DisallowProxylessTCP(t *testing.T) {
	userInputConfig := `
$type: tcpudp
tcp: # results in direct dialer
udp:
    $type: shadowsocks
    endpoint: example.com:53
    cipher: chacha20-ietf-poly1305
    secret: SECRET`
	result := doParseTunnelConfig(userInputConfig)
	require.NotNil(t, result.Error, "Expected an error for proxyless TCP")
	require.Equal(t, platerrors.InvalidConfig, result.Error.Code)
	require.Equal(t, "transport must tunnel TCP traffic", result.Error.Message)
}

func TestParseConfig_ClientFromJSON_Errors(t *testing.T) {
	tests := []struct {
		name  string
		input string // This is the "legacy JSON" input for doParseTunnelConfig
	}{
		{"missing host", `{"port":12345,"method":"some-cipher","password":"abcd1234"}`},
		{"missing port", `{"host":"192.0.2.1","method":"some-cipher","password":"abcd1234"}`},
		{"missing method", `{"host":"192.0.2.1","port":12345,"password":"abcd1234"}`},
		{"missing password", `{"host":"192.0.2.1","port":12345,"method":"some-cipher"}`},
		{"empty host", `{"host":"","port":12345,"method":"some-cipher","password":"abcd1234"}`},
		{"zero port", `{"host":"192.0.2.1","port":0,"method":"some-cipher","password":"abcd1234"}`},
		{"empty method", `{"host":"192.0.2.1","port":12345,"method":"","password":"abcd1234"}`},
		{"empty password", `{"host":"192.0.2.1","port":12345,"method":"some-cipher","password":""}`},
		{"port -1", `{"host":"192.0.2.1","port":-1,"method":"some-cipher","password":"abcd1234"}`},
		{"port 65536", `{"host":"192.0.2.1","port":65536,"method":"some-cipher","password":"abcd1234"}`},
		{"prefix out-of-range", `{"host":"192.0.2.1","port":8080,"method":"some-cipher","password":"abcd1234","prefix":"\x1234"}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := doParseTunnelConfig(tt.input)
			require.NotNil(t, got.Error, "doParseTunnelConfig() expected an error for input: %s", tt.input)
			// The specific error message might be "failed to create transport" due to wrapping in NewClient
			// or "failed to parse" if it's a very early syntax error for the legacy JSON.
			// For simplicity, we just check that an error of InvalidConfig type is returned.
			require.Equal(t, platerrors.InvalidConfig, got.Error.Code, "Unexpected error code for input: %s", tt.input)
		})
	}
}

func Test_doParseTunnelConfig_ProviderErrorUTF8(t *testing.T) {
	result := doParseTunnelConfig(`
error:
  message: "\u26a0 Invalid Access Key / Key \u1000\u102d\u102f\u1015\u103c\u1014\u103a\u101c\u100a\u103a\u1005\u1005\u103a\u1006\u1031\u1038\u1015\u1031\u1038\u1015\u102b\u104b"
  details: "\u26a0 Details / Key \u1000\u102d\u102f\u1015\u103c\u1014\u103a\u101c\u100a\u103a\u1005\u1005\u103a\u1006\u1031\u1038\u1015\u1031\u1038\u1015\u102b\u104b"
`)

	require.Equal(t, &platerrors.PlatformError{
		Code:    platerrors.ProviderError,
		Message: "⚠ Invalid Access Key / Key ကိုပြန်လည်စစ်ဆေးပေးပါ။",
		Details: map[string]any{
			"details": "⚠ Details / Key ကိုပြန်လည်စစ်ဆေးပေးပါ။",
		},
	}, result.Error)
}
