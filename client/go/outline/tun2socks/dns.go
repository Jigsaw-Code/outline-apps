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

package tun2socks

import (
	"github.com/Jigsaw-Code/outline-apps/client/go/outline"
	perrs "github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/vpn"
	"github.com/Jigsaw-Code/outline-sdk/network"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

type ClientTransportPair struct {
	client    *outline.Client
	wrappedSD transport.StreamDialer
	wrappedPP network.PacketProxy
}

type WrappedClientResult struct {
	Client *ClientTransportPair
	Error  *perrs.PlatformError
}

func WrapDNSInterceptedClient(client *outline.Client, localDNSIP, dnsServer string) *WrappedClientResult {
	sd, err := vpn.WrapDNSInterceptedStreamDialer(client, localDNSIP, dnsServer)
	if err != nil {
		return &WrappedClientResult{Error: &perrs.PlatformError{
			Code:    perrs.SetupTrafficHandlerFailed,
			Message: "failed to wrap DNS intercepted TCP handler",
			Cause:   perrs.ToPlatformError(err),
		}}
	}
	pp, err := vpn.WrapDNSInterceptedPacketProxy(client, localDNSIP, dnsServer)
	if err != nil {
		return &WrappedClientResult{Error: &perrs.PlatformError{
			Code:    perrs.SetupTrafficHandlerFailed,
			Message: "failed to wrap DNS intercepted UDP handler",
			Cause:   perrs.ToPlatformError(err),
		}}
	}
	return &WrappedClientResult{Client: &ClientTransportPair{
		client:    client,
		wrappedSD: sd,
		wrappedPP: pp,
	}}
}
