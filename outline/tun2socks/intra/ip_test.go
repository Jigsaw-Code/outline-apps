// Copyright 2023 Jigsaw Operations LLC
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

package intra

import (
	"net/netip"
	"testing"
)

func TestIsEquivalentAddrPort(t *testing.T) {
	cases := []struct {
		in1, in2 netip.AddrPort
		want     bool
		msg      string
	}{
		{
			in1:  netip.MustParseAddrPort("12.34.56.78:80"),
			in2:  netip.AddrPortFrom(netip.AddrFrom4([4]byte{12, 34, 56, 78}), 80),
			want: true,
		},
		{
			in1:  netip.MustParseAddrPort("[fe80::1234:5678]:443"),
			in2:  netip.AddrPortFrom(netip.AddrFrom16([16]byte{0xfe, 0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x12, 0x34, 0x56, 0x78}), 443),
			want: true,
		},
		{
			in1:  netip.MustParseAddrPort("0.0.0.0:80"),
			in2:  netip.MustParseAddrPort("127.0.0.1:80"),
			want: false,
		},
		{
			in1:  netip.AddrPortFrom(netip.IPv6Unspecified(), 80),
			in2:  netip.AddrPortFrom(netip.IPv6Loopback(), 80),
			want: false,
		},
		{
			in1:  netip.MustParseAddrPort("127.0.0.1:38880"),
			in2:  netip.MustParseAddrPort("127.0.0.1:38888"),
			want: false,
		},
		{
			in1:  netip.MustParseAddrPort("[2001:db8:85a3:8d3:1319:8a2e:370:7348]:33443"),
			in2:  netip.MustParseAddrPort("[2001:db8:85a3:8d3:1319:8a2e:370:7348]:33444"),
			want: false,
		},
		{
			in1:  netip.MustParseAddrPort("127.0.0.1:8080"),
			in2:  netip.MustParseAddrPort("[::ffff:127.0.0.1]:8080"),
			want: true,
		},
		{
			in1:  netip.AddrPortFrom(netip.IPv6Loopback(), 80),
			in2:  netip.MustParseAddrPort("127.0.0.1:80"),
			want: false,
		},
	}

	for _, tc := range cases {
		actual := isEquivalentAddrPort(tc.in1, tc.in2)
		if actual != tc.want {
			t.Fatalf(`"%v" == "%v"? want %v, actual %v`, tc.in1, tc.in2, tc.want, actual)
		}
	}
}
