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

package iptable

import (
	"fmt"
	"net/netip"
)

type IPTable[D any] interface {
	AddPrefix(prefix netip.Prefix, dialer D) error
	Lookup(ip netip.Addr) (D, error)
}

// Compile-time check
var _ IPTable[any] = (*ipTable[any])(nil)

const (
	maxIPv4PrefixLen = 32
	maxIPv6PrefixLen = 128
)

// "D" is typically expected to be a dialer of some kind
type ipTable[D any] struct {
	ipv4Buckets [maxIPv4PrefixLen + 1]map[netip.Prefix]D
	ipv6Buckets [maxIPv6PrefixLen + 1]map[netip.Prefix]D
}

func NewIPTable[V any]() IPTable[V] {
	return &ipTable[V]{}
}

func addInBuckets[V any](buckets []map[netip.Prefix]V, prefix netip.Prefix, dialer V) {
	if buckets[prefix.Bits()] == nil {
		buckets[prefix.Bits()] = make(map[netip.Prefix]V)
	}

	buckets[prefix.Bits()][prefix] = dialer
}

func (table *ipTable[V]) AddPrefix(prefix netip.Prefix, dialer V) error {
	if prefix.Addr().Is4() {
		addInBuckets(table.ipv4Buckets[:], prefix, dialer)
	} else {
		addInBuckets(table.ipv6Buckets[:], prefix, dialer)
	}
	return nil
}

func lookupInBuckets[V any](lookupAddress netip.Addr, buckets []map[netip.Prefix]V) (V, bool) {
	for length := len(buckets) - 1; length >= 0; length-- {
		bucket := buckets[length]
		if bucket == nil {
			continue
		}
		for prefix, value := range bucket {
			if prefix.Contains(lookupAddress) {
				return value, true
			}
		}
	}

	var zeroV V
	return zeroV, false
}

func (table *ipTable[V]) Lookup(lookupAddress netip.Addr) (V, error) {
	var value V
	var found bool

	if lookupAddress.Is4() {
		value, found = lookupInBuckets(lookupAddress, table.ipv4Buckets[:])
	} else {
		value, found = lookupInBuckets(lookupAddress, table.ipv6Buckets[:])
	}

	if found {
		return value, nil
	}

	var zeroV V
	return zeroV, fmt.Errorf("no matching prefix found for %s", lookupAddress.String())
}
