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
	"net"
	"net/netip"

	"github.com/Jigsaw-Code/outline-sdk/transport"
)

// -- TCP --

// TODO: different routing rules for different object types (generic?)
// TODO: AND/OR logic?
type StreamDialerRoutingRule struct {
	Prefix netip.Prefix
	Dialer transport.StreamDialer
}

type RouterStreamDialer struct {
	Rules []StreamDialerRoutingRule
}

var _ transport.StreamDialer = (*RouterStreamDialer)(nil)

func NewRouterStreamDialer(rules []StreamDialerRoutingRule) *RouterStreamDialer {
	return &RouterStreamDialer{
		Rules: rules,
	}
}

func (r *RouterStreamDialer) DialStream(ctx context.Context, raddr string) (transport.StreamConn, error) {
	address, err := netip.ParseAddr(raddr)
	if err != nil {
		return nil, err
	}

	for _, rule := range r.Rules {
		if rule.Prefix.Contains(address) {
			return rule.Dialer.DialStream(ctx, raddr)
		}
	}

	return &net.TCPConn{}, nil
}

// -- UDP --

// TODO: separate file?
type PacketDialerRoutingRule struct {
	Prefix netip.Prefix
	Dialer transport.PacketDialer
}

type RouterPacketDialer struct {
	Rules []PacketDialerRoutingRule
}

var _ transport.PacketDialer = (*RouterPacketDialer)(nil)

func NewRouterPacketDialer(rules []PacketDialerRoutingRule) *RouterPacketDialer {
	return &RouterPacketDialer{
		Rules: rules,
	}
}

func (r *RouterPacketDialer) DialPacket(ctx context.Context, raddr string) (net.Conn, error) {
	address, err := netip.ParseAddr(raddr)
	if err != nil {
		return nil, err
	}

	for _, rule := range r.Rules {
		if rule.Prefix.Contains(address) {
			return rule.Dialer.DialPacket(ctx, raddr)
		}
	}

	return &net.UDPConn{}, nil
}
