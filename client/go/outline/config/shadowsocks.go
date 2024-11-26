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

	"github.com/Jigsaw-Code/outline-sdk/transport"
	"github.com/Jigsaw-Code/outline-sdk/transport/shadowsocks"
)

type shadowsocksConfig struct {
	// TODO(fortuna): Replace with typed Endpoints to support Websocket.
	Endpoint EndpointConfig
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

func registerShadowsocksStreamDialer(r TypeRegistry[transport.StreamDialer], typeID string, newSE BuildFunc[transport.StreamEndpoint]) {
	r.RegisterType(typeID, func(ctx context.Context, config ConfigNode) (transport.StreamDialer, error) {
		params, err := newShadowsocksParams(config)
		if err != nil {
			return nil, err
		}
		endpoint, err := newSE(ctx, params.Endpoint)
		if err != nil {
			return nil, err
		}
		dialer, err := shadowsocks.NewStreamDialer(endpoint, params.Key)
		if err != nil {
			return nil, err
		}
		if params.SaltGenerator != nil {
			dialer.SaltGenerator = params.SaltGenerator
		}
		return dialer, nil
	})
}

func registerShadowsocksPacketDialer(r TypeRegistry[transport.PacketDialer], typeID string, newPE BuildFunc[transport.PacketEndpoint]) {
	r.RegisterType(typeID, func(ctx context.Context, config ConfigNode) (transport.PacketDialer, error) {
		params, err := newShadowsocksParams(config)
		if err != nil {
			return nil, err
		}
		endpoint, err := newPE(ctx, params.Endpoint)
		if err != nil {
			return nil, err
		}
		pl, err := shadowsocks.NewPacketListener(endpoint, params.Key)
		if err != nil {
			return nil, err
		}
		// TODO: support UDP prefix.
		return transport.PacketListenerDialer{Listener: pl}, nil
	})
}

func registerShadowsocksPacketListener(r TypeRegistry[transport.PacketListener], typeID string, newPE BuildFunc[transport.PacketEndpoint]) {
	r.RegisterType(typeID, func(ctx context.Context, config ConfigNode) (transport.PacketListener, error) {
		params, err := newShadowsocksParams(config)
		if err != nil {
			return nil, err
		}
		endpoint, err := newPE(ctx, params.Endpoint)
		if err != nil {
			return nil, err
		}
		return shadowsocks.NewPacketListener(endpoint, params.Key)
	})
}

type shadowsocksParams struct {
	Endpoint EndpointConfig
	Key *shadowsocks.EncryptionKey
	SaltGenerator shadowsocks.SaltGenerator
}

func parseShadowsocksConfig(node ConfigNode) (*shadowsocksConfig, error) {
	switch typed := node.(type) {
	case string:
		// TODO(fortuna): add URL support.
		return nil, errors.ErrUnsupported
	case map[string]any:
		if _, ok := typed["endpoint"]; ok {
			config := shadowsocksConfig{}
			if err := mapToAny(typed, &config); err != nil {
				return nil, err
			}
			var err error
			config.Endpoint, err = parseEndpointConfig(config.Endpoint)
			if err != nil {
				return nil, err
			}
			return &config, nil
		} else if _, ok := typed["server"]; ok {
			// Legacy format
			config := legacyShadowsocksConfig{}
			if err := mapToAny(typed, &config); err != nil {
				return nil, err
			}
			return &shadowsocksConfig{
				Endpoint: DialEndpointConfig{
					Address: net.JoinHostPort(config.Server, strconv.FormatUint(uint64(config.Server_Port), 10)),
				},
				Cipher: config.Method,
				Secret: config.Password,
				Prefix: config.Prefix,
			}, nil
		} else {
			return nil, fmt.Errorf("shadowsocks config missing endpoint")
		}
	default:
		return nil, fmt.Errorf("invalid shadowsocks config type %T", typed)
	}
}

func newShadowsocksParams(node ConfigNode) (*shadowsocksParams, error) {
	config, err := parseShadowsocksConfig(node)
	if err != nil {
		return nil, err
	}

	// Move to Endpoint code
	// if len(config.Endpoint.) == 0 {
	// 	return newIllegalConfigErrorWithDetails("host name or IP is not valid", "host", host, "not nil", nil)
	// }
	// if port <= 0 || port > 65535 {
	// 	return newIllegalConfigErrorWithDetails("port is not valid", "port", port, "within range [1..65535]", nil)
	// }

	if len(config.Cipher) == 0 {
		return nil, errors.New("cipher must not be empty")
	}
	if len(config.Secret) == 0 {
		return nil, errors.New("secret must not be empty")
	}

	params := &shadowsocksParams{
		Endpoint: config.Endpoint,
	}
	params.Key, err = shadowsocks.NewEncryptionKey(config.Cipher, config.Secret)
	if err != nil {
		return nil, fmt.Errorf("invalid key: %w", err)
	}
	if len(config.Prefix) > 0 {
		prefixBytes, err := parseStringPrefix(config.Prefix)
		if err != nil {
			return nil, fmt.Errorf("invalid prefix: %w", err)
		}
		params.SaltGenerator = shadowsocks.NewPrefixSaltGenerator(prefixBytes)
	}
	return params, nil
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
