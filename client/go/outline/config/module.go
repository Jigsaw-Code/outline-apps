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

import (
	"context"
	"net"

	"github.com/Jigsaw-Code/outline-sdk/transport"
)

type ConnType int

const (
	ConnTypeDirect ConnType = iota
	ConnTypeTunneled
)

// ConnProviderConfig represents a dialer or endpoint that can create connections.
type ConnectionProviderInfo struct {
	// The type of the connections that are provided
	ConnType ConnType
	// The address of the first hop.
	FirstHop string
}

type StreamDialer struct {
	ConnectionProviderInfo
	transport.StreamDialer
}

type PacketDialer struct {
	ConnectionProviderInfo
	transport.PacketDialer
}

type PacketListener struct {
	ConnectionProviderInfo
	transport.PacketListener
}

type GenericDialer[ConnType any] interface {
	Dial(ctx context.Context, address string) (ConnType, error)
}

type FuncGenericDialer[ConnType any] func(ctx context.Context, address string) (ConnType, error)

func (d FuncGenericDialer[ConnType]) Dial(ctx context.Context, address string) (ConnType, error) {
	return d(ctx, address)
}

var _ GenericDialer[any] = (FuncGenericDialer[any])(nil)

type GenericEndpoint[ConnType any] interface {
	Connect(ctx context.Context) (ConnType, error)
}

type Endpoint[ConnType any] struct {
	ConnectionProviderInfo
	GenericEndpoint[ConnType]
}

// ProviderContainer contains providers for the creation of network objects based on a config. The config is
// extensible by registering providers for different config subtypes.
type ProviderContainer struct {
	StreamDialers   *ExtensibleProvider[*StreamDialer]
	PacketDialers   *ExtensibleProvider[*PacketDialer]
	PacketListeners *ExtensibleProvider[*PacketListener]
	StreamEndpoints *EndpointProvider[transport.StreamConn]
	PacketEndpoints *EndpointProvider[net.Conn]
}

// NewProviderContainer creates a [ProviderContainer] with the base instances properly initialized.
func NewProviderContainer() *ProviderContainer {
	defaultStreamDialer := &StreamDialer{ConnectionProviderInfo{ConnTypeDirect, ""}, &transport.TCPDialer{}}
	defaultPacketDialer := &PacketDialer{ConnectionProviderInfo{ConnTypeDirect, ""}, &transport.UDPDialer{}}

	return &ProviderContainer{
		StreamDialers:   NewExtensibleProvider(defaultStreamDialer),
		PacketDialers:   NewExtensibleProvider(defaultPacketDialer),
		PacketListeners: NewExtensibleProvider(&PacketListener{ConnectionProviderInfo{ConnTypeDirect, ""}, &transport.UDPListener{}}),
		StreamEndpoints: &EndpointProvider[transport.StreamConn]{BaseDialer: FuncGenericDialer[transport.StreamConn](defaultStreamDialer.DialStream)},
		PacketEndpoints: &EndpointProvider[net.Conn]{BaseDialer: FuncGenericDialer[net.Conn](defaultPacketDialer.DialPacket)},
	}
}

// RegisterDefaultProviders registers a set of default providers with the providers in [ProviderContainer].
func RegisterDefaultProviders(c *ProviderContainer) *ProviderContainer {
	registerShadowsocksStreamDialer(c.StreamDialers, "ss", c.StreamEndpoints.NewInstance)
	registerShadowsocksStreamDialer(c.StreamDialers, "string", c.StreamEndpoints.NewInstance)

	registerShadowsocksPacketDialer(c.PacketDialers, "ss", c.PacketEndpoints.NewInstance)
	registerShadowsocksPacketDialer(c.PacketDialers, "string", c.PacketEndpoints.NewInstance)

	registerShadowsocksPacketListener(c.PacketListeners, "ss", c.PacketEndpoints.NewInstance)
	registerShadowsocksPacketListener(c.PacketListeners, "string", c.PacketEndpoints.NewInstance)
	return c
}
