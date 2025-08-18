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
)

// TODO. - define TbdBasicAccessType or get the right type from sdk/transport


// BasicAccessConfig is the format for the basic access DNS config.
type BasicAccessConfig struct {
	DnsResolvers configyaml.ConfigNode // list
}

func NewBasicAccessDNSResolverParser(parsePL configyaml.ParseFunc[*PacketListener]) func(ctx context.Context, input map[string]any) (*TbdBasicAccessType, error) {
	return func(ctx context.Context, input map[string]any) (*TbdBasicAccessType, error) {
		return parseBasicAccessDNSResolvers(ctx, input, parseSD, parsePL)
	}
}

func parseTCPUDPTransportPair(ctx context.Context, configMap map[string]any, parsePL configyaml.ParseFunc[*PacketListener]) (*TbdBasicAccessType, error) {
	var config BasicAccessConfig
	if err := configyaml.MapToAny(configMap, &config); err != nil {
		return nil, fmt.Errorf("invalid config format: %w", err)
	}


}