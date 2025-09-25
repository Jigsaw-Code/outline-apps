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

package config

import (
	"fmt"
	"log/slog"
	"net/netip"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/connectivity"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/dnsintercept"
	"github.com/Jigsaw-Code/outline-sdk/network"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

// OutlineDNSInterceptor is the default DNS interceptor for Outline.
//
// It checks for UDP connectivity to determine how to handle DNS queries.
//   - If UDP is healthy, it forwards DNS packets to the remote resolver.
//   - If UDP is unhealthy, it returns a truncated response to the client,
//     prompting the OS to retry the query over TCP.
//
// DNS queries made over TCP are always forwarded directly.
//
// This behavior must be backward compatible.
var OutlineDNSInterceptor = &TrafficInterceptor{
	WrapStreamDialer: wrapOutlineDNSStreamDialer,
	WrapPacketProxy:  wrapOutlineDNSPacketProxy,
}

// The default DNS resolver for Outline VPN.
//
// Previously we supported 4 resolvers: Cloudflare, Quad9, and OpenDNS
//   - 1.1.1.1, 9.9.9.9, 208.67.222.222, 208.67.220.220
//
// For now, we will hardcode to the first one.
//
// TODO: support multiple DNS resolvers
var defaultOutlineDNSResolver = netip.MustParseAddrPort("1.1.1.1:53")

func wrapOutlineDNSStreamDialer(t *TransportPair, interceptAddr string) (*Dialer[transport.StreamConn], error) {
	localDNS, err := netip.ParseAddrPort(interceptAddr)
	if err != nil {
		return nil, fmt.Errorf("invalid interceptAddr `%s`: %w", interceptAddr, err)
	}
	redirect, err := dnsintercept.WrapForwardStreamDialer(t, localDNS, defaultOutlineDNSResolver)
	if err != nil {
		return nil, fmt.Errorf("failed to create DNS redirect StreamDialer: %w", err)
	}
	return &Dialer[transport.StreamConn]{t.StreamDialer.ConnectionProviderInfo, redirect.DialStream}, nil
}

func wrapOutlineDNSPacketProxy(t *TransportPair, interceptAddr string) (*PacketProxy, error) {
	localDNS, err := netip.ParseAddrPort(interceptAddr)
	if err != nil {
		return nil, fmt.Errorf("invalid interceptAddr `%s`: %w", interceptAddr, err)
	}
	base, err := network.NewPacketProxyFromPacketListener(t.PacketListener)
	if err != nil {
		return nil, fmt.Errorf("failed to create PacketProxy: %w", err)
	}
	redirect, err := dnsintercept.WrapForwardPacketProxy(base, localDNS, defaultOutlineDNSResolver)
	if err != nil {
		return nil, fmt.Errorf("failed to create DNS redirect PacketProxy: %w", err)
	}
	trunc, err := dnsintercept.WrapTruncatePacketProxy(base, localDNS)
	if err != nil {
		return nil, fmt.Errorf("failed to create always-truncate DNS PacketProxy: %w", err)
	}
	main, err := network.NewDelegatePacketProxy(trunc)
	if err != nil {
		return nil, fmt.Errorf("failed to create indirect PacketProxy: %w", err)
	}

	onNetworkChanged := func() {
		if err := connectivity.CheckUDPConnectivity(t.PacketListener); err == nil {
			slog.Info("remote device UDP is healthy")
			main.SetProxy(redirect)
		} else {
			slog.Warn("remote device UDP is not healthy", "err", err)
			main.SetProxy(trunc)
		}
	}
	go onNetworkChanged()

	return &PacketProxy{t.PacketListener.ConnectionProviderInfo, main, onNetworkChanged}, nil
}
