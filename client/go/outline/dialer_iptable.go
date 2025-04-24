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

package outline

import (
	"context"
	"fmt"
	"net"
	"net/netip"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/iptable"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

func lookupTableDialer[D any](table iptable.IPTable[D], defaultDialer D, address string) D {
	host := address

	if _host, _, err := net.SplitHostPort(address); err == nil {
		host = _host
	}

	ip, err := netip.ParseAddr(host)
	if err == nil {
		if foundDialer, ok := table.Lookup(ip); ok {
			return foundDialer
		}
	}

	return defaultDialer
}

type IPTableStreamDialer struct {
	table         iptable.IPTable[transport.StreamDialer]
	defaultDialer transport.StreamDialer
}

func NewIPTableStreamDialer(table iptable.IPTable[transport.StreamDialer], defaultDialer transport.StreamDialer) (*IPTableStreamDialer, error) {
	if defaultDialer == nil {
		return nil, fmt.Errorf("defaultDialer cannot be nil")
	}
	if table == nil {
		table = iptable.NewIPTable[transport.StreamDialer]()
	}
	return &IPTableStreamDialer{
		table:         table,
		defaultDialer: defaultDialer,
	}, nil
}

func (dialer *IPTableStreamDialer) DialStream(ctx context.Context, address string) (transport.StreamConn, error) {
	return lookupTableDialer(dialer.table, dialer.defaultDialer, address).DialStream(ctx, address)
}

type IPTablePacketDialer struct {
	table         iptable.IPTable[transport.PacketDialer]
	defaultDialer transport.PacketDialer
}

func NewIPTablePacketDialer(table iptable.IPTable[transport.PacketDialer], defaultDialer transport.PacketDialer) (*IPTablePacketDialer, error) {
	if defaultDialer == nil {
		return nil, fmt.Errorf("defaultRoute cannot be nil")
	}
	if table == nil {
		table = iptable.NewIPTable[transport.PacketDialer]()
	}
	return &IPTablePacketDialer{
		table:         table,
		defaultDialer: defaultDialer,
	}, nil
}

func (dialer *IPTablePacketDialer) DialPacket(ctx context.Context, address string) (net.Conn, error) {
	return lookupTableDialer(dialer.table, dialer.defaultDialer, address).DialPacket(ctx, address)
}
