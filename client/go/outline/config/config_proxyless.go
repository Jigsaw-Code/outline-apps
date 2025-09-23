// Copyright 2025 The Outline Authors
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
	"math/rand"

	"github.com/Jigsaw-Code/outline-apps/client/go/configyaml"
	"github.com/Jigsaw-Code/outline-sdk/transport"
	"github.com/Jigsaw-Code/outline-sdk/transport/tlsfrag"
)

const (
	MIN_SPLIT int = 6
	MAX_SPLIT int = 64
)

type ProxylessConfig struct {
	// TODO: for now we simply parse the DNS resolvers and don't set them up
	Resolvers []configyaml.ConfigNode `yaml:"dns_resolvers"`
}

// Random number in the range [MIN_SPLIT, MAX_SPLIT]
// splitLength includes 5 bytes of TLS header
func randomSplitLength() int {
	splitLength := MIN_SPLIT + rand.Intn(MAX_SPLIT+1-MIN_SPLIT)
	return splitLength
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

	splitLength := randomSplitLength()

	sd, err := tlsfrag.NewFixedLenStreamDialer(&transport.TCPDialer{}, splitLength)
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
