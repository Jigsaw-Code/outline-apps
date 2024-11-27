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

type GenericDialer[ConnType any] interface {
	Dial(ctx context.Context, address string) (ConnType, error)
}

type FuncGenericDialer[ConnType any] func(ctx context.Context, address string) (ConnType, error)

func (d FuncGenericDialer[ConnType]) Dial(ctx context.Context, address string) (ConnType, error) {
	return d(ctx, address)
}

var _ GenericDialer[any] = (FuncGenericDialer[any])(nil)

type GenericEndpoint[ConnType any] interface {
	Connect(ctx context.Context) (ConnType, error)
}

type Endpoint[ConnType any] struct {
	ConnectionProviderInfo
	GenericEndpoint[ConnType]
}

type DialEndpointConfig struct {
	Address string
	// TODO(fortuna): Add dialer config.
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

// EndpointProvider creates instances of EndpointType in a way that can be extended via its [TypeRegistry] interface.
type EndpointProvider[ConnType any] struct {
	BaseDialer GenericDialer[ConnType]
	builders   map[string]BuildFunc[GenericEndpoint[ConnType]]
}

func (p *EndpointProvider[ConnType]) ensureBuildersMap() map[string]BuildFunc[GenericEndpoint[ConnType]] {
	if p.builders == nil {
		p.builders = make(map[string]BuildFunc[GenericEndpoint[ConnType]])
	}
	return p.builders
}

// RegisterType will register a factory for the given subtype.
func (p *EndpointProvider[ConnType]) RegisterType(subtype string, newInstance BuildFunc[GenericEndpoint[ConnType]]) {
	p.ensureBuildersMap()[subtype] = newInstance
}

// NewInstance creates a new instance of ObjectType according to the config.
func (p *EndpointProvider[ConnType]) NewInstance(ctx context.Context, node ConfigNode) (*Endpoint[ConnType], error) {
	if node == nil {
		return nil, errors.New("endpoint config cannot be nil")
	}

	dialParams, err := parseEndpointConfig(node)
	if err != nil {
		return nil, err
	}

	dialer := p.BaseDialer
	endpoint := &GenericDialerEndpoint[ConnType]{Address: dialParams.Address, Dialer: dialer}
	return &Endpoint[ConnType]{ConnectionProviderInfo{ConnTypeDirect, dialParams.Address}, endpoint}, nil
}

type GenericDialerEndpoint[ConnType any] struct {
	Address string
	Dialer  GenericDialer[ConnType]
}

func (e *GenericDialerEndpoint[ConnType]) Connect(ctx context.Context) (ConnType, error) {
	return e.Dialer.Dial(ctx, e.Address)
}
