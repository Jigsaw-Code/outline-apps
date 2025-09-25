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
	"github.com/Jigsaw-Code/outline-sdk/network"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

// OutlineDNSInterceptor is the default DNS interceptor used in Outline.
// It will ping for UDP health, when UDP is healthy, it forwards the packet to the remote resolver via the underlying transports.
// When UDP is not healthy, it truncates the DNS response immediately, and hopes the OS will retry the DNS query over TCP.
// The TCP traffic will be simply forwards to the remote resolver via the underlying transports as well.
// The behavior should be kept compatible with all versions.
var OutlineDNSInterceptor = &TrafficInterceptor{
	WrapStreamDialer: wrapOutlineDNSStreamDialer,
	WrapPacketProxy:  wrapOutlineDNSPacketProxy,
}

func wrapOutlineDNSStreamDialer(sd *Dialer[transport.StreamConn], interceptAddr string) (*Dialer[transport.StreamConn], error) {
	return sd, nil
}

func wrapOutlineDNSPacketProxy(pl *PacketListener, interceptAddr string) (*PacketProxy, error) {
	pp, err := network.NewPacketProxyFromPacketListener(pl)
	if err != nil {
		return nil, err
	}
	return &PacketProxy{pl.ConnectionProviderInfo, pp}, nil
}
