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

import (
	"testing"
)

func Test_parseConfigFromJSON(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    *configJSON
		wantErr bool
	}{
		{
			name:  "normal config",
			input: `{"host":"192.0.2.1","port":12345,"method":"some-cipher","password":"abcd1234"}`,
			want: &configJSON{
				Host:     "192.0.2.1",
				Port:     12345,
				Method:   "some-cipher",
				Password: "abcd1234",
				Prefix:   "",
			},
		},
		{
			name:  "normal config with prefix",
			input: `{"host":"192.0.2.1","port":12345,"method":"some-cipher","password":"abcd1234","prefix":"abc 123"}`,
			want: &configJSON{
				Host:     "192.0.2.1",
				Port:     12345,
				Method:   "some-cipher",
				Password: "abcd1234",
				Prefix:   "abc 123",
			},
		},
		{
			name:  "normal config with extra fields",
			input: `{"extra_field":"ignored","host":"192.0.2.1","port":12345,"method":"some-cipher","password":"abcd1234"}`,
			want: &configJSON{
				Host:     "192.0.2.1",
				Port:     12345,
				Method:   "some-cipher",
				Password: "abcd1234",
				Prefix:   "",
			},
		},
		{
			name:  "unprintable prefix",
			input: `{"host":"192.0.2.1","port":12345,"method":"some-cipher","password":"abcd1234","prefix":"abc 123","prefix":"\u0000\u0080\u00ff"}`,
			want: &configJSON{
				Host:     "192.0.2.1",
				Port:     12345,
				Method:   "some-cipher",
				Password: "abcd1234",
				Prefix:   "\u0000\u0080\u00ff",
			},
		},
		{
			name:  "multi-byte utf-8 prefix",
			input: `{"host":"192.0.2.1","port":12345,"method":"some-cipher","password":"abcd1234","prefix":"abc 123","prefix":"` + "\xc2\x80\xc2\x81\xc3\xbd\xc3\xbf" + `"}`,
			want: &configJSON{
				Host:     "192.0.2.1",
				Port:     12345,
				Method:   "some-cipher",
				Password: "abcd1234",
				Prefix:   "\u0080\u0081\u00fd\u00ff",
			},
		},
		{
			name:  "missing host",
			input: `{"port":12345,"method":"some-cipher","password":"abcd1234"}`,
			want: &configJSON{
				Host:     "",
				Port:     12345,
				Method:   "some-cipher",
				Password: "abcd1234",
				Prefix:   "",
			},
		},
		{
			name:  "missing port",
			input: `{"host":"192.0.2.1","method":"some-cipher","password":"abcd1234"}`,
			want: &configJSON{
				Host:     "192.0.2.1",
				Port:     0,
				Method:   "some-cipher",
				Password: "abcd1234",
				Prefix:   "",
			},
		},
		{
			name:  "missing method",
			input: `{"host":"192.0.2.1","port":12345,"password":"abcd1234"}`,
			want: &configJSON{
				Host:     "192.0.2.1",
				Port:     12345,
				Method:   "",
				Password: "abcd1234",
				Prefix:   "",
			},
		},
		{
			name:  "missing password",
			input: `{"host":"192.0.2.1","port":12345,"method":"some-cipher"}`,
			want: &configJSON{
				Host:     "192.0.2.1",
				Port:     12345,
				Method:   "some-cipher",
				Password: "",
				Prefix:   "",
			},
		},
		{
			name:  "empty host",
			input: `{"host":"","port":12345,"method":"some-cipher","password":"abcd1234"}`,
			want: &configJSON{
				Host:     "",
				Port:     12345,
				Method:   "some-cipher",
				Password: "abcd1234",
				Prefix:   "",
			},
		},
		{
			name:  "zero port",
			input: `{"host":"192.0.2.1","port":0,"method":"some-cipher","password":"abcd1234"}`,
			want: &configJSON{
				Host:     "192.0.2.1",
				Port:     0,
				Method:   "some-cipher",
				Password: "abcd1234",
				Prefix:   "",
			},
		},
		{
			name:  "empty method",
			input: `{"host":"192.0.2.1","port":12345,"method":"","password":"abcd1234"}`,
			want: &configJSON{
				Host:     "192.0.2.1",
				Port:     12345,
				Method:   "",
				Password: "abcd1234",
				Prefix:   "",
			},
		},
		{
			name:  "empty password",
			input: `{"host":"192.0.2.1","port":12345,"method":"some-cipher","password":""}`,
			want: &configJSON{
				Host:     "192.0.2.1",
				Port:     12345,
				Method:   "some-cipher",
				Password: "",
				Prefix:   "",
			},
		},
		{
			name:  "empty prefix",
			input: `{"host":"192.0.2.1","port":12345,"method":"some-cipher","password":"abcd1234","prefix":""}`,
			want: &configJSON{
				Host:     "192.0.2.1",
				Port:     12345,
				Method:   "some-cipher",
				Password: "abcd1234",
				Prefix:   "",
			},
		},
		{
			name:    "port -1",
			input:   `{"host":"192.0.2.1","port":-1,"method":"some-cipher","password":"abcd1234"}`,
			wantErr: true,
		},
		{
			name:    "port 65536",
			input:   `{"host":"192.0.2.1","port":65536,"method":"some-cipher","password":"abcd1234"}`,
			wantErr: true,
		},
		{
			name:    "prefix out-of-range",
			input:   `{"host":"192.0.2.1","port":8080,"method":"some-cipher","password":"abcd1234","prefix":"\x1234"}`,
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseConfigFromJSON(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseConfigFromJSON() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr {
				return
			}
			if got.Host != tt.want.Host ||
				got.Port != tt.want.Port ||
				got.Method != tt.want.Method ||
				got.Password != tt.want.Password ||
				got.Prefix != tt.want.Prefix {
				t.Errorf("ParseConfigFromJSON() = %v (prefix %+q), want %v (prefix %+q)", got, got.Prefix, tt.want, tt.want.Prefix)
			}
		})
	}
}
