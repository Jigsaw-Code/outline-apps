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

package shadowsocks

import "testing"

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
			got, err := NewClientFromJSON(tt.input)
			if err == nil || got != nil {
				t.Errorf("NewClientFromJSON() expects an error, got = %v", got)
				return
			}
		})
	}
}
