// Copyright 2023 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package device

import (
	"context"
	"fmt"
	"net"
	"strconv"

	"github.com/Jigsaw-Code/outline-apps/outline/config"
	"github.com/Jigsaw-Code/outline-sdk/network"
	"github.com/Jigsaw-Code/outline-sdk/network/dnstruncate"
	"github.com/Jigsaw-Code/outline-sdk/transport"
	"github.com/Jigsaw-Code/outline-sdk/transport/shadowsocks"
	"github.com/Jigsaw-Code/outline-sdk/x/connectivity"
)

type outlinePacketProxy struct {
	network.DelegatePacketProxy
	remote, fallback  network.PacketProxy
	remotePktListener transport.PacketListener // this will be used in connectivity test
}

func newOutlinePacketProxy(config *config.TransportConfig) (proxy *outlinePacketProxy, err error) {
	proxy = &outlinePacketProxy{}

	if proxy.remotePktListener, proxy.remote, err = makeRemotePacketProxy(config); err != nil {
		return nil, fmt.Errorf("failed to create packet proxy: %w", err)
	}

	if proxy.fallback, err = dnstruncate.NewPacketProxy(); err != nil {
		return nil, fmt.Errorf("failed to create DNS fallback packet proxy: %w", err)
	}

	if proxy.DelegatePacketProxy, err = network.NewDelegatePacketProxy(proxy.fallback); err != nil {
		return nil, fmt.Errorf("failed to create mutable packet proxy: %w", err)
	}

	return
}

// makeRemotePacketProxy creates a pair of [transport.PacketListener] and [network.PacketProxy] that connects to the
// remote proxy using `config`.
func makeRemotePacketProxy(
	config *config.TransportConfig,
) (pl transport.PacketListener, pp network.PacketProxy, err error) {
	server := net.JoinHostPort(config.Hostname, strconv.Itoa(config.Port))
	if pl, err = shadowsocks.NewPacketListener(&transport.UDPEndpoint{Address: server}, config.CryptoKey); err != nil {
		return nil, nil, err
	}
	if pp, err = network.NewPacketProxyFromPacketListener(pl); err != nil {
		return nil, nil, err
	}
	return
}

// testConnectivityAndRefresh tests whether the remote server can handle packet traffic and sets the underlying proxy
// to be either remote or fallback according to the result.
func (proxy *outlinePacketProxy) testConnectivityAndRefresh(resolver, domain string) error {
	dialer := transport.PacketListenerDialer{Listener: proxy.remotePktListener}
	dnsResolver := &transport.PacketDialerEndpoint{Dialer: dialer, Address: resolver}
	_, err := connectivity.TestResolverPacketConnectivity(context.Background(), dnsResolver, domain)

	if err != nil {
		return proxy.SetProxy(proxy.fallback)
	} else {
		return proxy.SetProxy(proxy.remote)
	}
}
