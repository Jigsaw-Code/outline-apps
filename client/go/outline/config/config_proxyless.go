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
	"fmt"

	"github.com/Jigsaw-Code/outline-apps/client/go/configyaml"
	"github.com/Jigsaw-Code/outline-sdk/transport"
	"github.com/Jigsaw-Code/outline-sdk/transport/tls"
)

// ProxylessConfig is the format for a proxyless config. It specifies a single transport config
// to create a [transport.StreamDialer].
type ProxylessConfig struct {
	Resolvers []configyaml.ConfigNode `yaml:"dns_resolvers"`
}

func NewProxylessTransportPairSubParser() func(ctx context.Context, input map[string]any) (*TransportPair, error) {
	return func(ctx context.Context, input map[string]any) (*TransportPair, error) {
		return parseProxylessTransportPair(ctx, input)
	}
}

func parseProxylessTransportPair(ctx context.Context, configMap map[string]any) (*TransportPair, error) {
	var config ProxylessConfig
	if err := configyaml.MapToAny(configMap, &config); err != nil {
		return nil, fmt.Errorf("invalid config format: %w", err)
	}

	// TODO: use config.Resolvers to create a custom DNS resolver.
	sd, err := tls.NewStreamDialer(&transport.TCPDialer{})
	if err != nil {
		return nil, fmt.Errorf("failed to create StreamDialer: %w", err)
	}

	return &TransportPair{
		StreamDialer: &Dialer[transport.StreamConn]{
			ConnectionProviderInfo: ConnectionProviderInfo{ConnType: ConnTypeDirect},
			Dial:                   sd.DialStream,
		},
		PacketListener: &PacketListener{ConnectionProviderInfo{ConnTypeDirect, ""}, &transport.UDPListener{}},
	}, nil
}
