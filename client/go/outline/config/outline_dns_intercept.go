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
	"math/rand/v2"
	"net/netip"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/connectivity"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/dnsintercept"
	"github.com/Jigsaw-Code/outline-sdk/network"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

// A list of public DNS resolvers that the VPN can use.
var outlineDNSResolvers = []string{
	"1.1.1.1:53",                             // Cloudflare
	"9.9.9.9:53",                             // Quad9
	"208.67.222.222:53", "208.67.220.220:53", // OpenDNS
}

// pickOutlineDNSResolverAddr randomly selects a DNS resolver for the VPN session.
// This new behavior is consistent across all platforms.
//
// Previously, each platform had a different approach:
//   - Android: the same as this implementation.
//   - Apple: used a fallback list of resolvers.
//   - Linux/Windows: used a single, hard-coded resolver.
func pickOutlineDNSResolverAddr() string {
	return outlineDNSResolvers[rand.IntN(len(outlineDNSResolvers))]
}

// pickOutlineLinkLocalDNSAddr returns a hard-coded link-local address for DNS interception.
//
// TODO: make this configurable via a new VpnConfig
func pickOutlineLinkLocalDNSAddr() string {
	return "169.254.113.53:53"
}

// wrapOutlineDNSStreamDialer intercepts DNS over TCP at localAddr and forwards them to the resolverAddr.
func wrapOutlineDNSStreamDialer(sd *Dialer[transport.StreamConn], localAddr, resolverAddr string) (*Dialer[transport.StreamConn], error) {
	localDNS, err := netip.ParseAddrPort(localAddr)
	if err != nil {
		return nil, fmt.Errorf("invalid local DNS address `%s`: %w", localAddr, err)
	}
	resolverDNS, err := netip.ParseAddrPort(resolverAddr)
	if err != nil {
		return nil, fmt.Errorf("invalid remote DNS address `%s`: %w", resolverAddr, err)
	}
	redirect, err := dnsintercept.WrapForwardStreamDialer(transport.FuncStreamDialer(sd.Dial), localDNS, resolverDNS)
	if err != nil {
		return nil, fmt.Errorf("failed to create DNS redirect StreamDialer: %w", err)
	}
	return &Dialer[transport.StreamConn]{sd.ConnectionProviderInfo, redirect.DialStream}, nil
}

// wrapOutlineDNSPacketProxy intercepts DNS over UDP at localAddr and forwards them to the resolverAddr.
//
// It also checks for UDP connectivity.
//   - If UDP is available, it forwards DNS queries to the specified resolverAddr.
//   - If UDP is blocked, it sends back a truncated DNS response.
//     This forces the OS to retry the DNS query over TCP.
func wrapOutlineDNSPacketProxy(pl *PacketListener, localAddr, resolverAddr string) (*PacketProxy, error) {
	localDNS, err := netip.ParseAddrPort(localAddr)
	if err != nil {
		return nil, fmt.Errorf("invalid local DNS address `%s`: %w", localAddr, err)
	}
	resolverDNS, err := netip.ParseAddrPort(resolverAddr)
	if err != nil {
		return nil, fmt.Errorf("invalid remote DNS address `%s`: %w", resolverAddr, err)
	}
	base, err := network.NewPacketProxyFromPacketListener(pl)
	if err != nil {
		return nil, fmt.Errorf("failed to create PacketProxy: %w", err)
	}
	redirect, err := dnsintercept.WrapForwardPacketProxy(base, localDNS, resolverDNS)
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
		go func() {
			if err := connectivity.CheckUDPConnectivity(pl); err == nil {
				slog.Info("remote device UDP is healthy")
				main.SetProxy(redirect)
			} else {
				slog.Warn("remote device UDP is not healthy", "err", err)
				main.SetProxy(trunc)
			}
		}()
	}

	return &PacketProxy{pl.ConnectionProviderInfo, main, onNetworkChanged}, nil
}
