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

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/iptable"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

type ipTableEntryConfig struct {
	IP     string     `yaml:"ip,omitempty"`
	Dialer ConfigNode `yaml:"dialer"`
}

type ipTableRootConfig struct {
	Table []ipTableEntryConfig `yaml:"table"`
}

type parsedIPTableStreamEntry struct {
	prefix netip.Prefix
	dialer transport.StreamDialer
}

func parseIPTableStreamDialer(
	ctx context.Context,
	configMap map[string]any,
	subDialerParser ParseFunc[*Dialer[transport.StreamConn]],
) (*iptable.IPTableStreamDialer, error) {
	var rootCfg ipTableRootConfig
	if err := mapToAny(configMap, &rootCfg); err != nil {
		return nil, fmt.Errorf("failed to map ip-table stream config: %w", err)
	}

	if len(rootCfg.Table) == 0 {
		return nil, errors.New("ip-table config 'table' must not be empty for stream dialer")
	}

	parsedEntries := make([]parsedIPTableStreamEntry, 0, len(rootCfg.Table))
	var defaultDialerEntry *parsedIPTableStreamEntry

	for i, entryCfg := range rootCfg.Table {
		parsedSubDialer, err := subDialerParser(ctx, entryCfg.Dialer)
		if err != nil {
			return nil, fmt.Errorf("failed to parse nested stream dialer for table entry %d (ip: %s): %w", i, entryCfg.IP, err)
		}

		currentEntry := parsedIPTableStreamEntry{
			dialer: transport.FuncStreamDialer(parsedSubDialer.Dial),
		}

		if entryCfg.IP == "" { // Default dialer
			if defaultDialerEntry != nil {
				return nil, errors.New("multiple default dialers specified in ip-table for stream")
			}
			defaultDialerEntry = &currentEntry
			continue
		}
		prefix, err := netip.ParsePrefix(entryCfg.IP)

		if err != nil { // Treat single IP as /32 or /128
			addr, errAddr := netip.ParseAddr(entryCfg.IP)
			if errAddr != nil {
				return nil, fmt.Errorf("invalid IP or prefix '%s' in ip-table entry %d: %w", entryCfg.IP, i, err)
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

	dialer, err := iptable.NewIPTableStreamDialer(table)

	if err != nil {
		return nil, fmt.Errorf("failed to create IPTableStreamDialer: %w", err)
	}

	dialer.SetDefault(defaultDialerEntry.dialer)

	return dialer, nil
}
