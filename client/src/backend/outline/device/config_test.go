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

package device

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func Test_ParseConfigFromJSON(t *testing.T) {
	tests := []struct {
		name          string
		input         string
		expectErr     bool
		expectAddress string
		expectPrefix  []byte
	}{
		{
			name:          "normal config",
			input:         `{"host":"192.0.2.1","port":12345,"method":"chacha20-ietf-poly1305","password":"abcd1234"}`,
			expectAddress: "192.0.2.1:12345",
		},
		{
			name:          "normal config with prefix",
			input:         `{"host":"192.0.2.1","port":12345,"method":"aes-128-gcm","password":"abcd1234","prefix":"abc 123"}`,
			expectAddress: "192.0.2.1:12345",
			expectPrefix:  []byte("abc 123"),
		},
		{
			name:          "normal config with extra fields",
			input:         `{"extra_field":"ignored","host":"192.0.2.1","port":12345,"method":"aes-192-gcm","password":"abcd1234"}`,
			expectAddress: "192.0.2.1:12345",
		},
		{
			name:          "unprintable prefix",
			input:         `{"host":"192.0.2.1","port":12345,"method":"AES-256-gcm","password":"abcd1234","prefix":"abc 123","prefix":"\u0000\u0080\u00ff"}`,
			expectAddress: "192.0.2.1:12345",
			expectPrefix:  []byte{0x00, 0x80, 0xff},
		},
		{
			name:          "multi-byte utf-8 prefix",
			input:         `{"host":"192.0.2.1","port":12345,"method":"chacha20-ietf-poly1305","password":"abcd1234","prefix":"abc 123","prefix":"` + "\xc2\x80\xc2\x81\xc3\xbd\xc3\xbf" + `"}`,
			expectAddress: "192.0.2.1:12345",
			expectPrefix:  []byte{0x80, 0x81, 0xfd, 0xff},
		},
		{
			name:      "missing host",
			input:     `{"port":12345,"method":"AES-128-GCM","password":"abcd1234"}`,
			expectErr: true,
		},
		{
			name:      "missing port",
			input:     `{"host":"192.0.2.1","method":"aes-192-gcm","password":"abcd1234"}`,
			expectErr: true,
		},
		{
			name:      "missing method",
			input:     `{"host":"192.0.2.1","port":12345,"password":"abcd1234"}`,
			expectErr: true,
		},
		{
			name:      "missing password",
			input:     `{"host":"192.0.2.1","port":12345,"method":"chacha20-ietf-poly1305"}`,
			expectErr: true,
		},
		{
			name:      "empty host",
			input:     `{"host":"","port":12345,"method":"chacha20-ietf-poly1305","password":"abcd1234"}`,
			expectErr: true,
		},
		{
			name:      "zero port",
			input:     `{"host":"192.0.2.1","port":0,"method":"chacha20-ietf-poly1305","password":"abcd1234"}`,
			expectErr: true,
		},
		{
			name:      "empty method",
			input:     `{"host":"192.0.2.1","port":12345,"method":"","password":"abcd1234"}`,
			expectErr: true,
		},
		{
			name:      "empty password",
			input:     `{"host":"192.0.2.1","port":12345,"method":"chacha20-ietf-poly1305","password":""}`,
			expectErr: true,
		},
		{
			name:      "empty prefix",
			input:     `{"host":"192.0.2.1","port":12345,"method":"some-cipher","password":"abcd1234","prefix":""}`,
			expectErr: true,
		},
		{
			name:      "port -1",
			input:     `{"host":"192.0.2.1","port":-1,"method":"aes-128-gcm","password":"abcd1234"}`,
			expectErr: true,
		},
		{
			name:      "port 65536",
			input:     `{"host":"192.0.2.1","port":65536,"method":"aes-128-gcm","password":"abcd1234"}`,
			expectErr: true,
		},
		{
			name:      "prefix out-of-range",
			input:     `{"host":"192.0.2.1","port":8080,"method":"aes-128-gcm","password":"abcd1234","prefix":"\x1234"}`,
			expectErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseConfigFromJSON(tt.input)
			if tt.expectErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expectAddress, got.RemoteAddress)
				require.NotNil(t, got.CryptoKey)
				require.Equal(t, tt.expectPrefix, got.Prefix)
			}
		})
	}
}
