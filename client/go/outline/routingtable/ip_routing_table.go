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
	"container/list"
	"fmt"
	"net/netip"
)

// Compile-time check
var _ RoutingTable[netip.Prefix, netip.Addr, any] = (*IPRoutingTable[any])(nil)

// "V" is typically expected to be a dialer of some kind
type IPRoutingTable[V any] struct {
	prefixBuckets map[int]map[netip.Prefix]V
	prefixLengths *list.List
}

func NewIPRoutingTable[V any]() *IPRoutingTable[V] {
	return &IPRoutingTable[V]{
		prefixBuckets: make(map[int]map[netip.Prefix]V),
		prefixLengths: list.New(),
	}
}

func (table *IPRoutingTable[V]) AddRoute(prefixRule netip.Prefix, dialer V) error {
	length := prefixRule.Bits()
	if _, ok := table.prefixBuckets[length]; !ok {
		table.prefixBuckets[length] = make(map[netip.Prefix]V)

		inserted := false

		for node := table.prefixLengths.Front(); node != nil; node = node.Next() {
			currentLength := node.Value.(int)
			if length > currentLength {
				table.prefixLengths.InsertBefore(length, node)
				inserted = true
				break
			}
		}

		if !inserted {
			table.prefixLengths.PushBack(length)
		}
	}

	table.prefixBuckets[length][prefixRule] = dialer
	return nil
}

func (table *IPRoutingTable[V]) Lookup(lookupAddress netip.Addr) (V, error) {
	for node := table.prefixLengths.Front(); node != nil; node = node.Next() {
		bucket := table.prefixBuckets[node.Value.(int)]
		for route, dialer := range bucket {
			if route.Contains(lookupAddress) {
				return dialer, nil
			}
		}
	}

	var zeroV V
	return zeroV, fmt.Errorf("no matching prefix found for %s", lookupAddress.String())
}
