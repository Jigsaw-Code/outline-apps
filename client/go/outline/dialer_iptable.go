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

func lookupInTable[D any](table iptable.IPTable[D], address string) (foundDialer D, ok bool) {
	host := address
	if _host, _, err := net.SplitHostPort(address); err == nil {
		host = _host
	}

	ip, err := netip.ParseAddr(host)
	if err == nil {
		return table.Lookup(ip)
	}

	var zeroD D
	return zeroD, false
}

type IPTableStreamDialer struct {
	table         iptable.IPTable[transport.StreamDialer]
	defaultDialer transport.StreamDialer
}

func NewIPTableStreamDialer(table iptable.IPTable[transport.StreamDialer]) (*IPTableStreamDialer, error) {
	if table == nil {
		table = iptable.NewIPTable[transport.StreamDialer]()
	}
	return &IPTableStreamDialer{
		table: table,
	}, nil
}

func (dialer *IPTableStreamDialer) AddDefault(defaultDialer transport.StreamDialer) error {
	if defaultDialer == nil {
		return fmt.Errorf("defaultRoute cannot be nil")
	}

	dialer.defaultDialer = defaultDialer
	return nil
}

func (dialer *IPTableStreamDialer) DialStream(ctx context.Context, address string) (transport.StreamConn, error) {
	selectedDialer, ok := lookupInTable(dialer.table, address)

	if !ok {
		selectedDialer = dialer.defaultDialer
		if selectedDialer == nil {
			return nil, fmt.Errorf("no dialer available for address %s", address)
		}
	}

	return selectedDialer.DialStream(ctx, address)
}

type IPTablePacketDialer struct {
	table         iptable.IPTable[transport.PacketDialer]
	defaultDialer transport.PacketDialer
}

func NewIPTablePacketDialer(table iptable.IPTable[transport.PacketDialer]) (*IPTablePacketDialer, error) {
	if table == nil {
		table = iptable.NewIPTable[transport.PacketDialer]()
	}
	return &IPTablePacketDialer{
		table: table,
	}, nil
}

func (dialer *IPTablePacketDialer) AddDefault(defaultDialer transport.PacketDialer) error {
	if defaultDialer == nil {
		return fmt.Errorf("defaultRoute cannot be nil")
	}

	dialer.defaultDialer = defaultDialer
	return nil
}

func (dialer *IPTablePacketDialer) DialPacket(ctx context.Context, address string) (net.Conn, error) {
	selectedDialer, ok := lookupInTable(dialer.table, address)

	if !ok {
		selectedDialer = dialer.defaultDialer
		if selectedDialer == nil {
			return nil, fmt.Errorf("no dialer available for address %s", address)
		}
	}

	return selectedDialer.DialPacket(ctx, address)
}
