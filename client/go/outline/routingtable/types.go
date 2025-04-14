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

// The RoutingTable defines a generic interface for adding matching routes (like an IP prefix)
// to match a potentially different key (like a specific IP address) to find a value.
type RoutingTable[R any, M any, V any] interface {
	// Implementations should handle potential conflicts or errors.
	AddRoute(rule R, value V) error

	// Implementations should define the lookup logic (e.g., exact, longest prefix).
	Lookup(matchKey M) (V, error)
}
