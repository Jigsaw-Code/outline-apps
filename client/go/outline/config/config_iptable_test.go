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

package config

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/Jigsaw-Code/outline-apps/client/go/configyaml"
	"github.com/Jigsaw-Code/outline-sdk/transport"
	"github.com/stretchr/testify/require"
)

func TestParseIPTableStreamDialer(t *testing.T) {
	ctx := context.Background()

	// Define a set of mock dialers for our tests to use.
	parseSE := func(ctx context.Context, config configyaml.ConfigNode) (*Dialer[transport.StreamConn], error) {
		configMap, ok := config.(map[string]any)
		if !ok {
			return nil, errors.New("config is not a map[string]any")
		}

		name, ok := configMap["name"].(string)
		if !ok {
			return nil, errors.New("mock dialer config must have a 'name'")
		}

		var dialer transport.StreamDialer
		connType := ConnTypeTunneled
		switch name {
		case "dialerA":
			dialer = &errorStreamDialer{name: "dialerA"}
		case "dialerB":
			dialer = &errorStreamDialer{name: "dialerB"}
		case "default":
			dialer = &errorStreamDialer{name: "default"}
		case "direct":
			dialer = &errorStreamDialer{name: "direct"}
			connType = ConnTypeDirect
		default:
			return nil, fmt.Errorf("no mock dialer found with name: %s", name)
		}
		return &Dialer[transport.StreamConn]{Dial: dialer.DialStream, ConnectionProviderInfo: ConnectionProviderInfo{ConnType: connType}}, nil
	}

	// Define test cases
	testCases := []struct {
		name             string
		configYAML       string
		expectErr        string
		checkDialer      func(*testing.T, *Dialer[transport.StreamConn])
		expectedConnType ConnType
	}{
		{
			name: "Happy Path - valid config",
			configYAML: `
table:
  - ip: 192.168.1.0/24
    dialer: {name: dialerA}
  - ip: 10.0.0.1
    dialer: {name: dialerB}
  - ip: 0.0.0.0/0
    dialer: {name: default}
`,
			checkDialer: func(t *testing.T, dialer *Dialer[transport.StreamConn]) {
				_, err := dialer.Dial(ctx, "192.168.1.100:1234")
				require.ErrorContains(t, err, "dialer 'dialerA' called for address '192.168.1.100:1234'")

				_, err = dialer.Dial(ctx, "10.0.0.1:5678")
				require.ErrorContains(t, err, "dialer 'dialerB' called for address '10.0.0.1:5678'")

				_, err = dialer.Dial(ctx, "8.8.8.8:53")
				require.ErrorContains(t, err, "dialer 'default' called for address '8.8.8.8:53'")
			},
			expectedConnType: ConnTypeTunneled,
		},
		{
			name: "Happy Path - no default dialer",
			configYAML: `
table:
  - ip: 192.168.1.0/24
    dialer: {name: dialerA}
`,
			expectedConnType: ConnTypeTunneled,
		},
		{
			name: "Happy Path - direct sub-dialer",
			configYAML: `
table:
  - ip: 192.168.1.0/24
    dialer: {name: direct}
  - ip: 0.0.0.0/0
    dialer: {name: default}
`,
			expectedConnType: ConnTypePartial,
		},
		{
			name: "Happy Path - exhaustive IPv4",
			configYAML: `
table:
  - ip: 0.0.0.0/1
    dialer: {name: dialerA}
  - ip: 128.0.0.0/1
    dialer: {name: dialerB}
`,
			expectedConnType: ConnTypeTunneled,
		},
		{
			name: "Happy Path - exhaustive IPv6",
			configYAML: `
table:
  - ip: ::/1
    dialer: {name: dialerA}
  - ip: 8000::/1
    dialer: {name: dialerB}
`,
			expectedConnType: ConnTypeTunneled,
		},
		{
			name: "Happy Path - exhaustive IPv4 with direct",
			configYAML: `
table:
  - ip: 0.0.0.0/1
    dialer: {name: direct}
  - ip: 128.0.0.0/1
    dialer: {name: dialerB}
`,
			expectedConnType: ConnTypePartial,
		},
		{
			name:       "Error - empty table",
			configYAML: `table: []`,
			expectErr:  "iptable config 'table' must not be empty for stream dialer",
		},
		{
			name: "Error - invalid IP",
			configYAML: `
table:
  - ip: not-an-ip
    dialer: {name: dialerA}
`,
			expectErr: "is not a valid IP address or CIDR prefix",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			node, err := configyaml.ParseConfigYAML(tc.configYAML)
			require.NoError(t, err)
			configMap, ok := node.(map[string]any)
			require.True(t, ok, "parsed yaml is not a map")

			dialer, err := parseIPTableStreamDialer(ctx, configMap, parseSE)

			if tc.expectErr != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tc.expectErr)
			} else {
				require.NoError(t, err)
				require.NotNil(t, dialer)
				require.Equal(t, tc.expectedConnType, dialer.ConnType)
				if tc.checkDialer != nil {
					tc.checkDialer(t, dialer)
				}
			}
		})
	}

	t.Run("Error - sub-dialer parser fails", func(t *testing.T) {
		errorParser := func(ctx context.Context, configMap configyaml.ConfigNode) (*Dialer[transport.StreamConn], error) {
			return nil, errors.New("sub-parser failed")
		}

		config := map[string]any{
			"table": []any{
				map[string]any{"ip": "192.168.1.0/24", "dialer": map[string]any{"name": "dialerA"}},
			},
		}

		_, err := parseIPTableStreamDialer(ctx, config, errorParser)
		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to parse nested stream dialer")
		require.Contains(t, err.Error(), "sub-parser failed")
	})
}
