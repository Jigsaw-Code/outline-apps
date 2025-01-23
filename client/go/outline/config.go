// Copyright 2022 The Outline Authors
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

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/internal/utf8"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
)

// Config represents a (legacy) shadowsocks server configuration. You can use
// NewClientFromJSON(string) instead.
//
// Deprecated: this object will be removed once we migrated from the old
// Outline Client logic.
type Config struct {
	Host       string
	Port       int
	Password   string
	CipherName string
	Prefix     []byte
}

func ParseConfigPrefixFromString(raw string) (p []byte, err error) {
	if len(raw) == 0 {
		return nil, nil
	}
	if p, err = utf8.DecodeUTF8CodepointsToRawBytes(raw); err != nil {
		return nil, newIllegalConfigErrorWithDetails("prefix is not valid", "prefix", raw, "string in utf-8", err)
	}
	return
}

// An internal data structure to be used by JSON deserialization.
// Must match the ShadowsocksSessionConfig interface defined in Outline Client.
type configJSON struct {
	Host     string `json:"host"`
	Port     uint16 `json:"port"`
	Password string `json:"password"`
	Method   string `json:"method"`
	Prefix   string `json:"prefix"`
}

// ParseConfigFromJSON parses a JSON string `in` as a configJSON object.
// The JSON string `in` must match the ShadowsocksSessionConfig interface
// defined in Outline Client.
func parseConfigFromJSON(in string) (*configJSON, error) {
	var conf configJSON
	if err := json.Unmarshal([]byte(in), &conf); err != nil {
		return nil, platerrors.PlatformError{
			Code:    platerrors.IllegalConfig,
			Message: "transport config is not a valid JSON",
			Cause:   platerrors.ToPlatformError(err),
		}
	}
	return &conf, nil
}

// validateConfig validates whether a Shadowsocks server configuration is valid
// (it won't do any connectivity tests)
//
// Returns nil if it is valid; or a [platerrors.PlatformError].
func validateConfig(host string, port int, cipher, password string) error {
	if len(host) == 0 {
		return newIllegalConfigErrorWithDetails("host name or IP is not valid", "host", host, "not nil", nil)
	}
	if port <= 0 || port > 65535 {
		return newIllegalConfigErrorWithDetails("port is not valid", "port", port, "within range [1..65535]", nil)
	}
	if len(cipher) == 0 {
		return newIllegalConfigErrorWithDetails("cipher method is not valid", "cipher", cipher, "not nil", nil)
	}
	if len(password) == 0 {
		return newIllegalConfigErrorWithDetails("password is not valid", "password", password, "not nil", nil)
	}
	return nil
}

// newIllegalConfigErrorWithDetails creates a TypeScript parsable IllegalConfig error with detailed information.
func newIllegalConfigErrorWithDetails(
	msg, field string, got interface{}, expect string, cause error,
) platerrors.PlatformError {
	return platerrors.PlatformError{
		Code:    platerrors.IllegalConfig,
		Message: msg,
		Details: platerrors.ErrorDetails{
			"proxy-protocol": "shadowsocks",
			"field":          field,
			"got":            got,
			"expected":       expect,
		},
		Cause: platerrors.ToPlatformError(cause),
	}
}
