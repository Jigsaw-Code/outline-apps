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
	"encoding/json"
	"fmt"
	"net"
	"strconv"

	"github.com/Jigsaw-Code/outline-sdk/transport/shadowsocks"
)

// An internal configuration data structure to be used by Outline transports.
type transportConfig struct {
	RemoteAddress string // the remote server address of "host:port"
	CryptoKey     *shadowsocks.EncryptionKey
	Prefix        []byte
}

// The configuration interface between the Outline backend and Outline apps.
// Must match the ShadowsocksSessionConfig interface defined in Outline Client.
type configJSON struct {
	Host     string `json:"host"`
	Port     uint16 `json:"port"`
	Password string `json:"password"`
	Method   string `json:"method"`
	Prefix   string `json:"prefix"`
}

// parseConfigFromJSON parses a transport configuration string in JSON format, and returns a corresponding
// TransportConfig. The JSON string `in` must match the ShadowsocksSessionConfig interface defined in Outline Client.
func parseConfigFromJSON(in string) (config *transportConfig, err error) {
	var confJson configJSON
	if err = json.Unmarshal([]byte(in), &confJson); err != nil {
		return nil, err
	}
	if err = validateConfig(&confJson); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	config = &transportConfig{
		RemoteAddress: net.JoinHostPort(confJson.Host, strconv.Itoa(int(confJson.Port))),
	}
	if config.CryptoKey, err = shadowsocks.NewEncryptionKey(confJson.Method, confJson.Password); err != nil {
		return nil, fmt.Errorf("invalid cipher: %w", err)
	}
	if len(confJson.Prefix) > 0 {
		if config.Prefix, err = parseStringPrefix(confJson.Prefix); err != nil {
			return nil, fmt.Errorf("invalid configuration prefix: %w", err)
		}
	}

	return config, nil
}

// validateConfig validates whether an Outline transport configuration is valid (it won't do any connectivity tests).
//
// Returns nil if it is valid; or an error if not.
func validateConfig(config *configJSON) error {
	if len(config.Host) == 0 {
		return fmt.Errorf("must provide a hostname or IP address")
	}
	if config.Port <= 0 || config.Port > 65535 {
		return fmt.Errorf("port must be within range [1..65535]")
	}
	if len(config.Method) == 0 {
		return fmt.Errorf("must provide an encryption cipher method")
	}
	if len(config.Password) == 0 {
		return fmt.Errorf("must provide an encryption cipher password")
	}
	return nil
}

func parseStringPrefix(utf8Str string) ([]byte, error) {
	runes := []rune(utf8Str)
	rawBytes := make([]byte, len(runes))
	for i, r := range runes {
		if (r & 0xFF) != r {
			return nil, fmt.Errorf("character out of range: %d", r)
		}
		rawBytes[i] = byte(r)
	}
	return rawBytes, nil
}
