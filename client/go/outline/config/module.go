// Copyright 2024 The Outline Authors
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

import "github.com/Jigsaw-Code/outline-sdk/transport"

// ProviderContainer contains providers for the creation of network objects based on a config. The config is
// extensible by registering providers for different config subtypes.
type ProviderContainer struct {
	StreamDialers   *ExtensibleProvider[transport.StreamDialer]
	PacketDialers   *ExtensibleProvider[transport.PacketDialer]
	PacketListeners *ExtensibleProvider[transport.PacketListener]
	StreamEndpoints *ExtensibleProvider[transport.StreamEndpoint]
	PacketEndpoints *ExtensibleProvider[transport.PacketEndpoint]
}

// NewProviderContainer creates a [ProviderContainer] with the base instances properly initialized.
func NewProviderContainer() *ProviderContainer {
	return &ProviderContainer{
		StreamDialers:   NewExtensibleProvider[transport.StreamDialer](&transport.TCPDialer{}),
		PacketDialers:   NewExtensibleProvider[transport.PacketDialer](&transport.UDPDialer{}),
		PacketListeners: NewExtensibleProvider[transport.PacketListener](&transport.UDPListener{}),
	}
}

// RegisterDefaultProviders registers a set of default providers with the providers in [ProviderContainer].
func RegisterDefaultProviders(c *ProviderContainer) *ProviderContainer {
	registerShadowsocksStreamDialer(c.StreamDialers, "ss", c.StreamEndpoints.NewInstance)
	registerShadowsocksPacketDialer(c.PacketDialers, "ss", c.PacketEndpoints.NewInstance)
	registerShadowsocksPacketListener(c.PacketListeners, "ss", c.PacketEndpoints.NewInstance)
	return c
}