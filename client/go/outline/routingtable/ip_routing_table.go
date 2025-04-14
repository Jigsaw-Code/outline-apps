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

package routingtable

import (
	"errors"
	"net"
	"net/netip"

	"github.com/yl2chen/cidranger"
	"go4.org/netipx"
)

// Compile-time check
var _ RoutingTable[netip.Prefix, netip.Addr, any] = (*IPRoutingTable[any])(nil)

// "V" is typically expected to be a dialer of some kind
type IPRoutingTable[V any] struct {
	prefixTrie cidranger.Ranger
}

type IPRoutingTableEntry[V any] struct {
	cidranger.RangerEntry
	Value V
}

func NewIPRoutingTable[V any]() *IPRoutingTable[V] {
	return &IPRoutingTable[V]{
		prefixTrie: cidranger.NewPCTrieRanger(),
	}
}

func (table *IPRoutingTable[V]) AddRoute(prefixRule netip.Prefix, dialer V) error {
	ipNet := netipx.PrefixIPNet(prefixRule)

	table.prefixTrie.Insert(&IPRoutingTableEntry[V]{
		RangerEntry: cidranger.NewBasicRangerEntry(*ipNet),
		Value:       dialer,
	})
	return nil
}

func (table *IPRoutingTable[V]) Lookup(matchKey netip.Addr) (V, error) {
	entry, err := table.prefixTrie.ContainingNetworks(net.ParseIP(matchKey.String()))

	var zeroValue V
	if err != nil {
		return zeroValue, err
	}

	if len(entry) == 0 {
		return zeroValue, errors.New("no entries found")
	}

	return entry[len(entry)-1].(*IPRoutingTableEntry[V]).Value, nil
}
