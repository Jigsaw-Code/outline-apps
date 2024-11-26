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

	"gopkg.in/yaml.v3"
)

type ConfigNode any

func ParseConfigYAML(configText string) (ConfigNode, error) {
	var node any
	if err := yaml.Unmarshal([]byte(configText), &node); err != nil {
		return nil, err
	}
	return node, nil
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

/*

type TunnelConfig struct {
	Transport TransportConfig
}

type TransportConfig DialerConfig

type DialerConfig any

type EndpointConfig any

type DialEndpointConfig struct {
	Address string
	Dialer  *DialerConfig
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

	parsedTransport, err := parseDialerConfig(rawTransport)
	if err != nil {
		return nil, err
	}
	tunnel.Transport = parsedTransport
	return &tunnel, nil
}

func parseDialerConfig(node any) (DialerConfig, error) {
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

*/