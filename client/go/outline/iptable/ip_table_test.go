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
	"testing"
)

func mustParsePrefix(s string) netip.Prefix {
	p, err := netip.ParsePrefix(s)
	if err != nil {
		panic(fmt.Sprintf("failed to parse prefix %q: %v", s, err))
	}
	return p
}

func mustParseAddr(s string) netip.Addr {
	a, err := netip.ParseAddr(s)
	if err != nil {
		panic(fmt.Sprintf("failed to parse addr %q: %v", s, err))
	}
	return a
}

func TestIPRoutingTable_Empty(t *testing.T) {
	table := NewIPTable[string]()
	ip := mustParseAddr("192.0.2.1")

	_, err := table.Lookup(ip)
	if err == nil {
		t.Errorf("Lookup(%v) on empty table succeeded unexpectedly, want error", ip)
	}
}

func TestIPRoutingTable_BasicLookup(t *testing.T) {
	table := NewIPTable[string]()
	prefix := mustParsePrefix("192.168.1.0/24")
	dialerID := "lan_dialer"
	err := table.AddPrefix(prefix, dialerID)
	if err != nil {
		t.Fatalf("AddPrefix failed: %v", err)
	}

	tests := []struct {
		name      string
		ip        netip.Addr
		wantValue string
		wantErr   bool
	}{
		{"IP within prefix", mustParseAddr("192.168.1.100"), dialerID, false},
		{"Network address", mustParseAddr("192.168.1.0"), dialerID, false},
		{"Broadcast address", mustParseAddr("192.168.1.255"), dialerID, false},
		{"IP outside prefix", mustParseAddr("192.168.2.1"), "", true},
		{"Different private range", mustParseAddr("10.0.0.1"), "", true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gotValue, gotErr := table.Lookup(tc.ip)

			if tc.wantErr {
				if gotErr == nil {
					t.Errorf("Lookup(%v) = %q, nil; want error", tc.ip, gotValue)
				}
			} else {
				if gotErr != nil {
					t.Errorf("Lookup(%v) unexpected error: %v", tc.ip, gotErr)
				}
				if gotValue != tc.wantValue {
					t.Errorf("Lookup(%v) = %q, want %q", tc.ip, gotValue, tc.wantValue)
				}
			}
		})
	}
}

func TestIPRoutingTable_LongestPrefixLookup(t *testing.T) {
	table := NewIPTable[string]()

	// Add routes - order shouldn't matter for matching logic if AddPrefix is correct
	p16 := mustParsePrefix("192.168.0.0/16")
	p24 := mustParsePrefix("192.168.1.0/24")
	p25 := mustParsePrefix("192.168.1.128/25")
	pDefault := mustParsePrefix("0.0.0.0/0")

	table.AddPrefix(p16, "dialer_16")           // Wider
	table.AddPrefix(p24, "dialer_24")           // Specific
	table.AddPrefix(pDefault, "dialer_default") // Default
	table.AddPrefix(p25, "dialer_25")           // Most specific

	tests := []struct {
		name      string
		ip        netip.Addr
		wantValue string
		wantErr   bool
	}{
		{"Matches /25", mustParseAddr("192.168.1.200"), "dialer_25", false},
		{"Matches /24", mustParseAddr("192.168.1.10"), "dialer_24", false},
		{"Matches /16", mustParseAddr("192.168.2.50"), "dialer_16", false},
		{"Matches default", mustParseAddr("10.1.1.1"), "dialer_default", false},
		{"Matches /25 network addr", mustParseAddr("192.168.1.128"), "dialer_25", false},
		{"Matches /25 broadcast addr", mustParseAddr("192.168.1.255"), "dialer_25", false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gotValue, gotErr := table.Lookup(tc.ip)

			if tc.wantErr { // Although none are expected here
				if gotErr == nil {
					t.Errorf("Lookup(%v) = %q, nil; want error", tc.ip, gotValue)
				}
			} else {
				if gotErr != nil {
					t.Errorf("Lookup(%v) unexpected error: %v", tc.ip, gotErr)
				}
				if gotValue != tc.wantValue {
					t.Errorf("Lookup(%v) = %q, want %q", tc.ip, gotValue, tc.wantValue)
				}
			}
		})
	}
}

func TestIPRoutingTable_IPv6Lookup(t *testing.T) {
	table := NewIPTable[string]()

	p32 := mustParsePrefix("2001:db8::/32")
	p48 := mustParsePrefix("2001:db8:1::/48")
	p64 := mustParsePrefix("2001:db8:1:1::/64")
	pDefault := mustParsePrefix("::/0")

	table.AddPrefix(p32, "dialer_32")
	table.AddPrefix(p48, "dialer_48")
	table.AddPrefix(p64, "dialer_64")
	table.AddPrefix(pDefault, "dialer_default_v6")

	tests := []struct {
		name      string
		ip        netip.Addr
		wantValue string
		wantErr   bool
	}{
		{"Matches /64", mustParseAddr("2001:db8:1:1::1"), "dialer_64", false},
		{"Matches /48", mustParseAddr("2001:db8:1:2::1"), "dialer_48", false},
		{"Matches /32", mustParseAddr("2001:db8:2::1"), "dialer_32", false},
		{"Matches default v6", mustParseAddr("2001:db9::1"), "dialer_default_v6", false},
		{"Matches different default v6", mustParseAddr("::1"), "dialer_default_v6", false}, // Loopback matches ::/0
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gotValue, gotErr := table.Lookup(tc.ip)

			if tc.wantErr {
				if gotErr == nil {
					t.Errorf("Lookup(%v) = %q, nil; want error", tc.ip, gotValue)
				}
			} else {
				if gotErr != nil {
					t.Errorf("Lookup(%v) unexpected error: %v", tc.ip, gotErr)
				}
				if gotValue != tc.wantValue {
					t.Errorf("Lookup(%v) = %q, want %q", tc.ip, gotValue, tc.wantValue)
				}
			}
		})
	}
}

func TestIPRoutingTable_MixedIPv4IPv6(t *testing.T) {
	table := NewIPTable[string]()

	p24 := mustParsePrefix("192.168.1.0/24")
	p64 := mustParsePrefix("2001:db8:1:1::/64")
	pDefaultV4 := mustParsePrefix("0.0.0.0/0")
	pDefaultV6 := mustParsePrefix("::/0")

	table.AddPrefix(p24, "dialer_v4_lan")
	table.AddPrefix(p64, "dialer_v6_lan")
	table.AddPrefix(pDefaultV4, "dialer_default_v4")
	table.AddPrefix(pDefaultV6, "dialer_default_v6")

	tests := []struct {
		name      string
		ip        netip.Addr
		wantValue string
		wantErr   bool
	}{
		{"Lookup IPv4 LAN", mustParseAddr("192.168.1.100"), "dialer_v4_lan", false},
		{"Lookup IPv4 Default", mustParseAddr("8.8.8.8"), "dialer_default_v4", false},
		{"Lookup IPv6 LAN", mustParseAddr("2001:db8:1:1:aaaa::1"), "dialer_v6_lan", false},
		{"Lookup IPv6 Default", mustParseAddr("2606:4700:4700::1111"), "dialer_default_v6", false},
		// Ensure IPv4 doesn't match IPv6 default and vice-versa IF they were different
		// (Here they might point to the same conceptual 'default', but test specificity)
		{"IPv4 doesn't match v6 route", mustParseAddr("192.168.1.1"), "dialer_v4_lan", false},            // Should not match v6 /64
		{"IPv6 doesn't match v4 route", mustParseAddr("::ffff:192.168.1.1"), "dialer_default_v6", false}, // IPv4-mapped shouldn't match /24, hits default v6
	}

	// If default v4 and v6 point to different things:
	table2 := NewIPTable[string]()
	table2.AddPrefix(pDefaultV4, "ONLY_V4_DEFAULT")
	table2.AddPrefix(pDefaultV6, "ONLY_V6_DEFAULT")
	tests = append(tests,
		struct {
			name      string
			ip        netip.Addr
			wantValue string
			wantErr   bool
		}{
			"IPv4 hits V4 default", mustParseAddr("8.8.8.8"), "ONLY_V4_DEFAULT", false,
		},
		struct {
			name      string
			ip        netip.Addr
			wantValue string
			wantErr   bool
		}{
			"IPv6 hits V6 default", mustParseAddr("2001::1"), "ONLY_V6_DEFAULT", false,
		},
	)

	for _, tc := range tests {
		// Use appropriate router for the test case
		currentTable := table
		if tc.wantValue == "ONLY_V4_DEFAULT" || tc.wantValue == "ONLY_V6_DEFAULT" {
			currentTable = table2
		}

		t.Run(tc.name, func(t *testing.T) {
			gotValue, gotErr := currentTable.Lookup(tc.ip)

			if tc.wantErr {
				if gotErr == nil {
					t.Errorf("Lookup(%v) = %q, nil; want error", tc.ip, gotValue)
				}
			} else {
				if gotErr != nil {
					t.Errorf("Lookup(%v) unexpected error: %v", tc.ip, gotErr)
				}
				if gotValue != tc.wantValue {
					t.Errorf("Lookup(%v) = %q, want %q", tc.ip, gotValue, tc.wantValue)
				}
			}
		})
	}
}

func TestIPRoutingTable_SameLengthPrefixes(t *testing.T) {
	table := NewIPTable[string]()

	pLen := 24
	pV4 := mustParsePrefix(fmt.Sprintf("198.51.100.0/%d", pLen))
	pV6 := mustParsePrefix(fmt.Sprintf("2001:db8:cafe::/%d", pLen))

	valV4 := "value_v4_len24"
	valV6 := "value_v6_len24"

	table.AddPrefix(pV4, valV4)
	table.AddPrefix(pV6, valV6)

	tests := []struct {
		name      string
		ip        netip.Addr
		wantValue string
		wantErr   bool
	}{
		{"IPv4 within its /24", mustParseAddr("198.51.100.50"), valV4, false},
		{"IPv6 within its /24", mustParseAddr("2001:db8:ca00::1"), valV6, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gotValue, gotErr := table.Lookup(tc.ip)

			if tc.wantErr {
				if gotErr == nil {
					t.Errorf("Lookup(%v) = %q, nil; want error", tc.ip, gotValue)
				}
				// Can add specific error checking here if needed
			} else {
				if gotErr != nil {
					t.Errorf("Lookup(%v) unexpected error: %v", tc.ip, gotErr)
				}
				if gotValue != tc.wantValue {
					t.Errorf("Lookup(%v) = %q, want %q", tc.ip, gotValue, tc.wantValue)
				}
			}
		})
	}
}

func TestIPRoutingTable_OverwriteRule(t *testing.T) {
	table := NewIPTable[string]()
	prefix := mustParsePrefix("10.0.0.0/8")

	err := table.AddPrefix(prefix, "first_value")
	if err != nil {
		t.Fatalf("First AddPrefix failed: %v", err)
	}

	err = table.AddPrefix(prefix, "second_value") // Add same prefix again
	if err != nil {
		t.Fatalf("Second AddPrefix failed: %v", err)
	}

	ip := mustParseAddr("10.1.2.3")
	gotValue, gotErr := table.Lookup(ip)

	if gotErr != nil {
		t.Errorf("Lookup(%v) unexpected error: %v", ip, gotErr)
	}
	if gotValue != "second_value" {
		t.Errorf("Lookup(%v) = %q, want %q (expected overwrite)", ip, gotValue, "second_value")
	}
}
