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
	"errors"
	"fmt"
	"net/netip"

	"github.com/Jigsaw-Code/outline-apps/client/go/configyaml"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/iptable"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

type ipTableRootConfig struct {
	Table    []ipTableEntryConfig  `yaml:"table"`
	Fallback configyaml.ConfigNode `yaml:"fallback,omitempty"`
}

type ipTableEntryConfig struct {
	IP     string                `yaml:"ip"`
	Dialer configyaml.ConfigNode `yaml:"dialer"`
}

func parseIPTableStreamDialer(
	ctx context.Context,
	configMap map[string]any,
	parseSD configyaml.ParseFunc[*Dialer[transport.StreamConn]],
) (*Dialer[transport.StreamConn], error) {
	var rootCfg ipTableRootConfig
	if err := configyaml.MapToAny(configMap, &rootCfg); err != nil {
		return nil, fmt.Errorf("failed to map iptable stream config: %w", err)
	}

	if len(rootCfg.Table) == 0 {
		return nil, errors.New("iptable config 'table' must not be empty for stream dialer")
	}

	allConnTunnelled := true
	allConnDirect := true

	parsedFallbackDialer, err := parseSD(ctx, rootCfg.Fallback)

	if err != nil {
		return nil, fmt.Errorf("failed to parse nested stream dialer fallback: %w", err)
	}

	if parsedFallbackDialer.ConnType != ConnTypeTunneled {
		allConnTunnelled = false
	}

	if parsedFallbackDialer.ConnType != ConnTypeDirect {
		allConnDirect = false
	}

	dialerTable := iptable.NewIPTable[transport.StreamDialer]()
	for i, entryCfg := range rootCfg.Table {
		parsedSubDialer, err := parseSD(ctx, entryCfg.Dialer)
		if err != nil {
			return nil, fmt.Errorf("failed to parse nested stream dialer for table entry %d (ip: %s): %w", i, entryCfg.IP, err)
		}

		if parsedSubDialer.ConnType != ConnTypeTunneled {
			allConnTunnelled = false
		}

		if parsedSubDialer.ConnType != ConnTypeDirect {
			allConnDirect = false
		}

		var currentPrefix netip.Prefix
		parsedPrefix, errPrefix := netip.ParsePrefix(entryCfg.IP)
		if errPrefix == nil {
			currentPrefix = parsedPrefix
		} else {
			addr, errAddr := netip.ParseAddr(entryCfg.IP)
			if errAddr != nil {
				return nil, fmt.Errorf("iptable entry %d IP '%s' is not a valid IP address or CIDR prefix: failed to parse as prefix (%v) and failed to parse as address (%v)", i, entryCfg.IP, errPrefix, errAddr)
			}
			currentPrefix = netip.PrefixFrom(addr, addr.BitLen())
		}

		dialerTable.AddPrefix(currentPrefix, transport.FuncStreamDialer(parsedSubDialer.Dial))
	}

	dialer, err := iptable.NewStreamDialer(dialerTable, transport.FuncStreamDialer(parsedFallbackDialer.Dial))

	if err != nil {
		return nil, fmt.Errorf("failed to create IPTableStreamDialer: %w", err)
	}

	var connType ConnType
	if allConnDirect && allConnTunnelled {
		// This should never happen because we require len(rootCfg.Table) != 0
		return nil, fmt.Errorf("allConnDirect and allConnTunnelled cannot both be true")
	} else if allConnTunnelled {
		connType = ConnTypeTunneled
	} else if allConnDirect {
		connType = ConnTypeDirect
	} else {
		connType = ConnTypePartial
	}

	return &Dialer[transport.StreamConn]{
		Dial: dialer.DialStream,
		ConnectionProviderInfo: ConnectionProviderInfo{
			ConnType: connType,
		},
	}, nil
}

func NewIPTableStreamDialerSubParser(parseSD configyaml.ParseFunc[*Dialer[transport.StreamConn]]) func(ctx context.Context, input map[string]any) (*Dialer[transport.StreamConn], error) {
	return func(ctx context.Context, input map[string]any) (*Dialer[transport.StreamConn], error) {
		return parseIPTableStreamDialer(ctx, input, parseSD)
	}
}
