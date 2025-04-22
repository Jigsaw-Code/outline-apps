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

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/iptable" // Assuming iptable is in this location
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

func getRecord[V any](table iptable.IPTable[V], address string) (V, error) {
	var zeroV V
	host, _, err := net.SplitHostPort(address)

	if err != nil {
		return zeroV, err
	}

	ip, err := netip.ParseAddr(host)
	if err != nil {
		return zeroV, err
	}

	record, ok := table.Lookup(ip)
	if !ok {
		return zeroV, fmt.Errorf("no dialer found for address: %s", address)
	}

	return record, nil
}

type IPTableStreamDialer struct {
	table iptable.IPTable[transport.StreamDialer]
}

func NewIPTableStreamDialer(table *iptable.IPTable[transport.StreamDialer]) (*IPTableStreamDialer, error) {
	if table == nil {
		return nil, fmt.Errorf("table cannot be nil")
	}

	return &IPTableStreamDialer{
		table: table,
	}, nil
}

func (dialer *IPTableStreamDialer) DialStream(ctx context.Context, address string) (transport.StreamConn, error) {
	dialer, err := getRecord(dialer.table, address)
	if err != nil {
		return nil, err
	}

	return dialer.DialStream(ctx, address)
}

type IPTablePacketDialer struct {
	table *iptable.IPTable[transport.PacketDialer]
}

func NewIPTablePacketDialer(table *iptable.IPTable[transport.PacketDialer]) (*IPTablePacketDialer, error) {
	if table == nil {
		return nil, fmt.Errorf("table cannot be nil")
	}

	return &IPTablePacketDialer{
		table: table,
	}, nil
}

func (dialer *IPTablePacketDialer) DialPacket(ctx context.Context, address string) (net.PacketConn, error) {
	dialer, err := getRecord(dialer.table, address)
	if err != nil {
		return nil, err
	}

	return dialer.DialPacket(ctx, address)
}
