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
	"context"
	"fmt"
	"net"
	"net/netip"

	"github.com/Jigsaw-Code/outline-sdk/transport"
)

func lookupInTable[D any](table IPTable[D], address string) (foundDialer D, ok bool) {
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

// StreamDialer is a [transport.StreamDialer] that routes connections
// based on the destination IP address using an [IPTable].
// If a specific route is found in the table, the corresponding dialer is used.
// Otherwise, the default dialer (if set) is used.
type StreamDialer struct {
	table         IPTable[transport.StreamDialer]
	defaultDialer transport.StreamDialer
}

// NewStreamDialer creates a new [StreamDialer].
// If the provided table is nil, a new empty table will be created internally.
// It returns the new dialer and a nil error.
func NewStreamDialer(table IPTable[transport.StreamDialer]) (*StreamDialer, error) {
	if table == nil {
		table = NewIPTable[transport.StreamDialer]()
	}
	return &StreamDialer{
		table: table,
	}, nil
}

// SetDefault sets the dialer to be used when no specific route is found
// for a destination address in the IP table.
// Passing nil will clear the default dialer.
func (dialer *StreamDialer) SetDefault(defaultDialer transport.StreamDialer) {
	dialer.defaultDialer = defaultDialer
}

// DialStream dials the given address using the appropriate [transport.StreamDialer]
// determined by looking up the destination IP in the IP table.
// If no specific route is found, it uses the default dialer.
// If no specific route is found and no default dialer is set, or if the
// selected dialer fails, it returns an error.
func (dialer *StreamDialer) DialStream(ctx context.Context, address string) (transport.StreamConn, error) {
	selectedDialer, ok := lookupInTable(dialer.table, address)

	if !ok {
		selectedDialer = dialer.defaultDialer
	}

	if selectedDialer == nil {
		return nil, fmt.Errorf("no dialer available for address %s", address)
	}

	return selectedDialer.DialStream(ctx, address)
}

// PacketDialer is a [transport.PacketDialer] that routes connections
// based on the destination IP address using an [IPTable].
// If a specific route is found in the table, the corresponding dialer is used.
// Otherwise, the default dialer (if set) is used.
type PacketDialer struct {
	table         IPTable[transport.PacketDialer]
	defaultDialer transport.PacketDialer
}

// NewPacketDialer creates a new [PacketDialer].
// If the provided table is nil, a new empty table will be created internally.
// It returns the new dialer and a nil error.
func NewPacketDialer(table IPTable[transport.PacketDialer]) (*PacketDialer, error) {
	if table == nil {
		table = NewIPTable[transport.PacketDialer]()
	}
	return &PacketDialer{
		table: table,
	}, nil
}

// SetDefault sets the dialer to be used when no specific route is found
// for a destination address in the IP table.
// Passing nil will clear the default dialer.
func (dialer *PacketDialer) SetDefault(defaultDialer transport.PacketDialer) {
	dialer.defaultDialer = defaultDialer
}

// DialPacket dials the given address using the appropriate [transport.PacketDialer]
// determined by looking up the destination IP in the IP table.
// If no specific route is found, it uses the default dialer.
// If no specific route is found and no default dialer is set, or if the
// selected dialer fails, it returns an error.
func (dialer *PacketDialer) DialPacket(ctx context.Context, address string) (net.Conn, error) {
	selectedDialer, ok := lookupInTable(dialer.table, address)

	if !ok {
		selectedDialer = dialer.defaultDialer
	}

	if selectedDialer == nil {
		return nil, fmt.Errorf("no dialer available for address %s", address)
	}

	return selectedDialer.DialPacket(ctx, address)
}
