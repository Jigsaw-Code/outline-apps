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
	"context"
	"errors"
	"fmt"
	"net"
	"strconv"
)

// DialEndpointConfig is the format for the Dial Endpoint config.
type DialEndpointConfig struct {
	Address string
	Dialer  any
}

func parseDirectDialerEndpoint[ConnType any](ctx context.Context, config any, newDialer ParseFunc[*Dialer[ConnType]]) (*Endpoint[ConnType], error) {
	if config == nil {
		return nil, errors.New("endpoint config cannot be nil")
	}

	dialParams, err := parseEndpointConfig(config)
	if err != nil {
		return nil, err
	}

	dialer, err := newDialer(ctx, dialParams.Dialer)
	if err != nil {
		return nil, fmt.Errorf("failed to create sub-dialer: %w", err)
	}

	endpoint := &Endpoint[ConnType]{
		Connect: func(ctx context.Context) (ConnType, error) {
			return dialer.Dial(ctx, dialParams.Address)
		},
		ConnectionProviderInfo: dialer.ConnectionProviderInfo,
	}
	if dialer.ConnType == ConnTypeDirect {
		endpoint.ConnectionProviderInfo.FirstHop = dialParams.Address
	}
	return endpoint, nil
}

func parseEndpointConfig(node ConfigNode) (*DialEndpointConfig, error) {
	config, err := toDialEndpointConfig(node)
	if err != nil {
		return nil, err
	}
	host, portText, err := net.SplitHostPort(config.Address)
	if err != nil {
		return nil, fmt.Errorf("invalid address format: %w", err)
	}
	if host == "" {
		return nil, errors.New("host must not be empty")
	}
	if portText == "" {
		return nil, errors.New("port must not be empty")
	}
	port, err := strconv.ParseUint(portText, 10, 16)
	if err != nil {
		return nil, fmt.Errorf("invalid port number: %w", err)
	}
	if port == 0 {
		return nil, errors.New("port must not be zero")
	}
	return config, err
}

func toDialEndpointConfig(node ConfigNode) (*DialEndpointConfig, error) {
	switch typed := node.(type) {
	case string:
		return &DialEndpointConfig{Address: typed}, nil

	case map[string]any:
		// TODO: Make it type-based
		config := &DialEndpointConfig{}
		if err := mapToAny(typed, &config); err != nil {
			return nil, err
		}
		return config, nil

	default:
		return nil, fmt.Errorf("endpoint config of type %T is not supported", typed)
	}
}
