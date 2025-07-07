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

// mockSubDialerParser returns a mock parsing function for our tests.
// This function simulates the behavior of a real sub-dialer parser.
// It looks for a "name" in the config and returns the corresponding mock dialer.
func mockSubDialerParser(dialers map[string]transport.StreamDialer) configyaml.ParseFunc[*Dialer[transport.StreamConn]] {
	return func(ctx context.Context, config configyaml.ConfigNode) (*Dialer[transport.StreamConn], error) {
		configMap, ok := config.(map[string]any)
		if !ok {
			return nil, errors.New("config is not a map[string]any")
		}

		name, ok := configMap["name"].(string)
		if !ok {
			return nil, errors.New("mock dialer config must have a 'name'")
		}

		dialer, ok := dialers[name]
		if !ok {
			return nil, fmt.Errorf("no mock dialer found with name: %s", name)
		}

		return &Dialer[transport.StreamConn]{
			Dial: dialer.DialStream,
		}, nil
	}
}

func TestParseIPTableStreamDialer(t *testing.T) {
	ctx := context.Background()

	// Define a set of mock dialers for our tests to use.
	mockDialers := map[string]transport.StreamDialer{
		"dialerA": &mockStreamDialer{name: "dialerA"},
		"dialerB": &mockStreamDialer{name: "dialerB"},
		"default": &mockStreamDialer{name: "default"},
	}

	// Create a parser instance with our mock dialers.
	parser := mockSubDialerParser(mockDialers)

	// Define test cases
	testCases := []struct {
		name        string
		config      map[string]any
		expectErr   string
		checkDialer func(*testing.T, transport.StreamDialer)
	}{
		{
			name: "Happy Path - valid config",
			config: map[string]any{
				"table": []any{
					map[string]any{"ip": "192.168.1.0/24", "dialer": map[string]any{"name": "dialerA"}},
					map[string]any{"ip": "10.0.0.1", "dialer": map[string]any{"name": "dialerB"}},
					map[string]any{"ip": "", "dialer": map[string]any{"name": "default"}},
				},
			},
			checkDialer: func(t *testing.T, dialer transport.StreamDialer) {
				_, err := dialer.DialStream(ctx, "192.168.1.100:1234")
				require.ErrorContains(t, err, "dialer 'dialerA' called for address '192.168.1.100:1234'")

				_, err = dialer.DialStream(ctx, "10.0.0.1:5678")
				require.ErrorContains(t, err, "dialer 'dialerB' called for address '10.0.0.1:5678'")

				_, err = dialer.DialStream(ctx, "8.8.8.8:53")
				require.ErrorContains(t, err, "dialer 'default' called for address '8.8.8.8:53'")
			},
		},
		{
			name:      "Error - empty table",
			config:    map[string]any{"table": []any{}},
			expectErr: "ip-table config 'table' must not be empty for stream dialer",
		},
		{
			name: "Error - multiple defaults",
			config: map[string]any{
				"table": []any{
					map[string]any{"ip": "", "dialer": map[string]any{"name": "default"}},
					map[string]any{"ip": "", "dialer": map[string]any{"name": "dialerA"}},
				},
			},
			expectErr: "multiple default dialers specified in ip-table for stream",
		},
		{
			name: "Error - invalid IP",
			config: map[string]any{
				"table": []any{
					map[string]any{"ip": "not-an-ip", "dialer": map[string]any{"name": "dialerA"}},
					map[string]any{"ip": "", "dialer": map[string]any{"name": "default"}},
				},
			},
			expectErr: "is not a valid IP address or CIDR prefix",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			dialer, err := parseIPTableStreamDialer(ctx, tc.config, parser)

			if tc.expectErr != "" {
				require.Contains(t, err.Error(), tc.expectErr)
			} else {
				require.NoError(t, err)
				require.NotNil(t, dialer)
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
