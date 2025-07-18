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

type ipTableEntryConfig struct {
	IP     string                `yaml:"ip,omitempty"`
	Dialer configyaml.ConfigNode `yaml:"dialer"`
}

type ipTableRootConfig struct {
	Table []ipTableEntryConfig `yaml:"table"`
}

// parsedIPTableStreamEntry is an internal struct to hold a parsed prefix and its corresponding stream dialer.
type parsedIPTableStreamEntry struct {
	prefix netip.Prefix
	dialer transport.StreamDialer
}

func parseIPTableStreamDialer(
	ctx context.Context,
	configMap map[string]any,
	parseSD configyaml.ParseFunc[*Dialer[transport.StreamConn]],
) (*iptable.StreamDialer, error) {
	var rootCfg ipTableRootConfig
	if err := configyaml.MapToAny(configMap, &rootCfg); err != nil {
		return nil, fmt.Errorf("failed to map iptable stream config: %w", err)
	}

	if len(rootCfg.Table) == 0 {
		return nil, errors.New("iptable config 'table' must not be empty for stream dialer")
	}

	parsedEntries := make([]parsedIPTableStreamEntry, 0, len(rootCfg.Table))
	var defaultDialerEntry *parsedIPTableStreamEntry

	for i, entryCfg := range rootCfg.Table {
		parsedSubDialer, err := parseSD(ctx, entryCfg.Dialer)
		if err != nil {
			return nil, fmt.Errorf("failed to parse nested stream dialer for table entry %d (ip: %s): %w", i, entryCfg.IP, err)
		}

		currentEntry := parsedIPTableStreamEntry{
			dialer: transport.FuncStreamDialer(parsedSubDialer.Dial),
		}

		if entryCfg.IP == "" { // Default dialer
			if defaultDialerEntry != nil {
				return nil, errors.New("multiple default dialers specified in iptable for stream")
			}
			defaultDialerEntry = &currentEntry
			continue
		}

		var prefix netip.Prefix
		parsedPrefix, errPrefix := netip.ParsePrefix(entryCfg.IP)
		if errPrefix == nil {
			prefix = parsedPrefix
		} else {
			addr, errAddr := netip.ParseAddr(entryCfg.IP)
			if errAddr != nil {
				return nil, fmt.Errorf("iptable entry %d IP '%s' is not a valid IP address or CIDR prefix: failed to parse as prefix (%v) and failed to parse as address (%v)", i, entryCfg.IP, errPrefix, errAddr)
			}
			prefix = netip.PrefixFrom(addr, addr.BitLen())
		}

		currentEntry.prefix = prefix
		parsedEntries = append(parsedEntries, currentEntry)
	}

	table := iptable.NewIPTable[transport.StreamDialer]()

	for _, entry := range parsedEntries {
		table.AddPrefix(entry.prefix, entry.dialer)
	}

	dialer, err := iptable.NewStreamDialer(table)

	if err != nil {
		return nil, fmt.Errorf("failed to create IPTableStreamDialer: %w", err)
	}

	if defaultDialerEntry != nil {
		dialer.SetDefault(defaultDialerEntry.dialer)
	}

	return dialer, nil
}

func NewIPTableStreamDialerSubParser(parseSD configyaml.ParseFunc[*Dialer[transport.StreamConn]]) func(ctx context.Context, input map[string]any) (*Dialer[transport.StreamConn], error) {
	return func(ctx context.Context, input map[string]any) (*Dialer[transport.StreamConn], error) {
		streamDialer, err := parseIPTableStreamDialer(ctx, input, parseSD)

		return &Dialer[transport.StreamConn]{
			Dial: streamDialer.DialStream,
			ConnectionProviderInfo: ConnectionProviderInfo{
				ConnType: ConnTypeTunneled,
				FirstHop: "",
			},
		}, err
	}
}
