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

package router

import (
	"container/list"
	"fmt"
	"net/netip"
)

// Compile-time check
var _ Router[netip.Prefix, netip.Addr, any] = (*IPRouter[any])(nil)

// "V" is typically expected to be a dialer of some kind
type IPRouter[V any] struct {
	prefixBuckets map[int]map[netip.Prefix]V
	prefixLengths *list.List
}

func NewIPRouter[V any]() *IPRouter[V] {
	return &IPRouter[V]{
		prefixBuckets: make(map[int]map[netip.Prefix]V),
		prefixLengths: list.New(),
	}
}

func (router *IPRouter[V]) AddRule(prefixRule netip.Prefix, dialer V) error {
	length := prefixRule.Bits()
	if _, ok := router.prefixBuckets[length]; !ok {
		router.prefixBuckets[length] = make(map[netip.Prefix]V)

		inserted := false

		for node := router.prefixLengths.Front(); node != nil; node = node.Next() {
			currentLength := node.Value.(int)
			if length > currentLength {
				router.prefixLengths.InsertBefore(length, node)
				inserted = true
				break
			}
		}

		if !inserted {
			router.prefixLengths.PushBack(length)
		}
	}

	router.prefixBuckets[length][prefixRule] = dialer
	return nil
}

func (router *IPRouter[V]) Match(matchKey netip.Addr) (V, error) {
	for node := router.prefixLengths.Front(); node != nil; node = node.Next() {
		bucket := router.prefixBuckets[node.Value.(int)]
		for prefixRule, dialer := range bucket {
			if prefixRule.Contains(matchKey) {
				return dialer, nil
			}
		}
	}

	var zeroV V
	return zeroV, fmt.Errorf("no matching prefix found for %s", matchKey.String())
}
