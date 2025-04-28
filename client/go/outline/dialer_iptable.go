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

// IPTableStreamDialer is a [transport.StreamDialer] that routes connections
// based on the destination IP address using an [iptable.IPTable].
// If a specific route is found in the table, the corresponding dialer is used.
// Otherwise, the default dialer (if set) is used.
type IPTableStreamDialer struct {
	table         iptable.IPTable[transport.StreamDialer]
	defaultDialer transport.StreamDialer
}

// NewIPTableStreamDialer creates a new [IPTableStreamDialer].
// If the provided table is nil, a new empty table will be created internally.
// It returns the new dialer and a nil error.
func NewIPTableStreamDialer(table iptable.IPTable[transport.StreamDialer]) (*IPTableStreamDialer, error) {
	if table == nil {
		table = iptable.NewIPTable[transport.StreamDialer]()
	}
	return &IPTableStreamDialer{
		table: table,
	}, nil
}

// SetDefault sets the dialer to be used when no specific route is found
// for a destination address in the IP table.
// Passing nil will clear the default dialer.
func (dialer *IPTableStreamDialer) SetDefault(defaultDialer transport.StreamDialer) {
	dialer.defaultDialer = defaultDialer
}

// DialStream dials the given address using the appropriate [transport.StreamDialer]
// determined by looking up the destination IP in the IP table.
// If no specific route is found, it uses the default dialer.
// If no specific route is found and no default dialer is set, or if the
// selected dialer fails, it returns an error.
func (dialer *IPTableStreamDialer) DialStream(ctx context.Context, address string) (transport.StreamConn, error) {
	selectedDialer, ok := lookupInTable(dialer.table, address)

	if !ok {
		selectedDialer = dialer.defaultDialer
	}

	if selectedDialer == nil {
		return nil, fmt.Errorf("no dialer available for address %s", address)
	}

	return selectedDialer.DialStream(ctx, address)
}

// IPTablePacketDialer is a [transport.PacketDialer] that routes connections
// based on the destination IP address using an [iptable.IPTable].
// If a specific route is found in the table, the corresponding dialer is used.
// Otherwise, the default dialer (if set) is used.
type IPTablePacketDialer struct {
	table         iptable.IPTable[transport.PacketDialer]
	defaultDialer transport.PacketDialer
}

// NewIPTablePacketDialer creates a new [IPTablePacketDialer].
// If the provided table is nil, a new empty table will be created internally.
// It returns the new dialer and a nil error.
func NewIPTablePacketDialer(table iptable.IPTable[transport.PacketDialer]) (*IPTablePacketDialer, error) {
	if table == nil {
		table = iptable.NewIPTable[transport.PacketDialer]()
	}
	return &IPTablePacketDialer{
		table: table,
	}, nil
}

// SetDefault sets the dialer to be used when no specific route is found
// for a destination address in the IP table.
// Passing nil will clear the default dialer.
func (dialer *IPTablePacketDialer) SetDefault(defaultDialer transport.PacketDialer) {
	dialer.defaultDialer = defaultDialer
}

// DialPacket dials the given address using the appropriate [transport.PacketDialer]
// determined by looking up the destination IP in the IP table.
// If no specific route is found, it uses the default dialer.
// If no specific route is found and no default dialer is set, or if the
// selected dialer fails, it returns an error.
func (dialer *IPTablePacketDialer) DialPacket(ctx context.Context, address string) (net.Conn, error) {
	selectedDialer, ok := lookupInTable(dialer.table, address)

	if !ok {
		selectedDialer = dialer.defaultDialer
	}

	if selectedDialer == nil {
		return nil, fmt.Errorf("no dialer available for address %s", address)
	}

	return selectedDialer.DialPacket(ctx, address)
}

// IPTablePacketListenerDialer is a [transport.PacketDialer] that routes connections
// based on the destination IP address using an [iptable.IPTable] containing
// [transport.PacketListenerDialer] instances.
//
// It allows different underlying [transport.PacketListener] instances to be used
// based on the destination IP.
type IPTablePacketListenerDialer struct {
	table         iptable.IPTable[transport.PacketListenerDialer]
	defaultDialer transport.PacketListenerDialer
}

// NewIPTablePacketListenerDialer creates a new [IPTablePacketListenerDialer].
// The provided table should map IP prefixes to [transport.PacketListenerDialer] instances.
// If the table is nil, a new empty table will be created internally.
// It returns the new dialer and a nil error.
func NewIPTablePacketListener(table iptable.IPTable[transport.PacketListenerDialer]) (*IPTablePacketListenerDialer, error) {
	if table == nil {
		table = iptable.NewIPTable[transport.PacketListenerDialer]()
	}
	return &IPTablePacketListenerDialer{
		table: table,
	}, nil
}

// SetDefault sets the [transport.PacketListenerDialer] to be used when no specific
// route is found for a destination address in the IP table.
// Passing a zero-value PacketListenerDialer (e.g., `transport.PacketListenerDialer{}`)
// effectively clears the default, as its internal Listener will be nil.
func (dialer *IPTablePacketListenerDialer) SetDefault(defaultDialer transport.PacketListenerDialer) {
	dialer.defaultDialer = defaultDialer
}

// DialPacket dials the given address using the appropriate [transport.PacketListenerDialer]
// determined by looking up the destination IP in the IP table.
// If no specific route is found, it uses the default dialer.
// If no specific route is found and no default dialer is set (or the default dialer's
// Listener is nil), or if the selected dialer fails, it returns an error.
func (dialer *IPTablePacketListenerDialer) DialPacket(ctx context.Context, address string) (net.Conn, error) {
	selectedDialer, ok := lookupInTable(dialer.table, address)
	if !ok {
		selectedDialer = dialer.defaultDialer
	}

	if selectedDialer.Listener == nil {
		return nil, fmt.Errorf("no dialer available")
	}

	return selectedDialer.DialPacket(ctx, address)
}
