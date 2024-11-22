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
	"bytes"
	"errors"
	"fmt"

	"gopkg.in/yaml.v3"
)

type TunnelConfig struct {
	Transport TransportConfig
}

type TransportConfig any

type endpointConfig struct {
	Host string
	Port uint16
}

type shadowsocksConfig struct {
	// TODO(fortuna): Replace with typed Endpoints to support Websocket.
	Endpoint endpointConfig
	Cipher   string
	Secret   string
	Prefix   string
}

type legacyShadowsocksConfig struct {
	Server      string
	Server_Port uint16
	Method      string
	Password    string
	Prefix      string
}

// ParseTunnelConfig parses and validates the config
func ParseTunnelConfig(configText string) (*TunnelConfig, error) {
	var node any
	if err := yaml.Unmarshal([]byte(configText), &node); err != nil {
		return nil, fmt.Errorf("tunnel config is not valid YAML: %w", err)
	}

	var tunnel TunnelConfig
	var rawTransport TransportConfig
	switch typed := node.(type) {
	case string:
		rawTransport = typed

	case map[string]any:
		if transport, ok := typed["transport"]; ok {
			// TODO: support separate TCP and UDP transports.
			rawTransport = transport
		} else {
			// If the transport field is missing, treat the entire object as the transport config.
			rawTransport = typed
		}

	default:
		return nil, fmt.Errorf("tunnel config of type %T is not supported", typed)
	}

	parsedTransport, err := parseTransportConfig(rawTransport)
	if err != nil {
		return nil, err
	}
	tunnel.Transport = parsedTransport
	return &tunnel, nil
}

func parseTransportConfig(node any) (*shadowsocksConfig, error) {
	switch typed := node.(type) {
	case string:
		// TODO: Implement URL config.
		return nil, errors.New("transport string not implemented")

	case map[string]any:
		if _, ok := typed["$type"]; ok {
			// TODO(fortuna): Implement other types.
			return nil, errors.New("typed transport not implemented")
		}

		return parseShadowsocksConfig(typed)
	}
	return nil, fmt.Errorf("transport config of type %T is not supported", node)
}

func parseShadowsocksConfig(node map[string]any) (*shadowsocksConfig, error) {
	if _, ok := node["endpoint"]; ok {
		config := &shadowsocksConfig{}
		if err := mapToAny(node, config); err != nil {
			return nil, err
		}
		return config, nil

	} else if _, ok := node["server"]; ok {
		// Legacy format
		config := &legacyShadowsocksConfig{}
		if err := mapToAny(node, config); err != nil {
			return nil, err
		}
		return &shadowsocksConfig{
			Endpoint: endpointConfig{
				Host: config.Server,
				Port: config.Server_Port,
			},
			Cipher: config.Method,
			Secret: config.Password,
			Prefix: config.Prefix,
		}, nil
	} else {
		return nil, fmt.Errorf("shadowsocks config missing endpoint")
	}
}

func mapToAny(in map[string]any, out any) error {
	yamlText, err := yaml.Marshal(in)
	if err != nil {
		return err
	}
	decoder := yaml.NewDecoder(bytes.NewReader(yamlText))
	decoder.KnownFields(true)
	return decoder.Decode(out)
}
