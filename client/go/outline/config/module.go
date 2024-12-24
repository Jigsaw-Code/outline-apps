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
	"errors"
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

type PacketListener struct {
	ConnectionProviderInfo
	transport.PacketListener
}

type DialFunc[ConnType any] func(ctx context.Context, address string) (ConnType, error)

type Dialer[ConnType any] struct {
	ConnectionProviderInfo
	Dial DialFunc[ConnType]
}

type ConnectFunc[ConnType any] func(ctx context.Context) (ConnType, error)

type Endpoint[ConnType any] struct {
	ConnectionProviderInfo
	Connect ConnectFunc[ConnType]
}

type TransportPair struct {
	StreamDialer   *Dialer[transport.StreamConn]
	PacketListener *PacketListener
}

var _ transport.StreamDialer = (*TransportPair)(nil)
var _ transport.PacketListener = (*TransportPair)(nil)

func (t *TransportPair) DialStream(ctx context.Context, address string) (transport.StreamConn, error) {
	return t.StreamDialer.Dial(ctx, address)
}

func (t *TransportPair) ListenPacket(ctx context.Context) (net.PacketConn, error) {
	return t.PacketListener.ListenPacket(ctx)
}

// // NewClientProvider creates a [ProviderContainer] with the base instances properly initialized.
// func NewClientProvider() *ExtensibleProvider[*TransportClient], FunctionRegistry[] {
// 	clients := NewExtensibleProvider[*TransportClient](nil)
// 	return clients

// 	defaultStreamDialer := &Dialer[transport.StreamConn]{ConnectionProviderInfo{ConnTypeDirect, ""}, (&transport.TCPDialer{}).DialStream}
// 	defaultPacketDialer := &Dialer[net.Conn]{ConnectionProviderInfo{ConnTypeDirect, ""}, (&transport.UDPDialer{}).DialPacket}

// 	return &ProviderContainer{
// 		StreamDialers:   NewExtensibleProvider(defaultStreamDialer),
// 		PacketDialers:   NewExtensibleProvider(defaultPacketDialer),
// 		PacketListeners: NewExtensibleProvider(&PacketListener{ConnectionProviderInfo{ConnTypeDirect, ""}, &transport.UDPListener{}}),
// 		StreamEndpoints: NewExtensibleProvider[*Endpoint[transport.StreamConn]](nil),
// 		PacketEndpoints: NewExtensibleProvider[*Endpoint[net.Conn]](nil),
// 	}
// }

// // RegisterDefaultProviders registers a set of default providers with the providers in [ProviderContainer].
// func RegisterDefaultProviders(c *ProviderContainer) *ProviderContainer {
// 	registerDirectDialEndpoint(c.StreamEndpoints, "string", c.StreamDialers.NewInstance)
// 	registerDirectDialEndpoint(c.StreamEndpoints, "dial", c.StreamDialers.NewInstance)
// 	registerDirectDialEndpoint(c.PacketEndpoints, "string", c.PacketDialers.NewInstance)
// 	registerDirectDialEndpoint(c.PacketEndpoints, "dial", c.PacketDialers.NewInstance)

// 	registerShadowsocksStreamDialer(c.StreamDialers, ProviderTypeDefault, c.StreamEndpoints.NewInstance)
// 	registerShadowsocksStreamDialer(c.StreamDialers, "ss", c.StreamEndpoints.NewInstance)
// 	registerShadowsocksStreamDialer(c.StreamDialers, "string", c.StreamEndpoints.NewInstance)

// 	registerShadowsocksPacketDialer(c.PacketDialers, "ss", c.PacketEndpoints.NewInstance)
// 	registerShadowsocksPacketDialer(c.PacketDialers, "string", c.PacketEndpoints.NewInstance)

// 	registerShadowsocksPacketListener(c.PacketListeners, ProviderTypeDefault, c.PacketEndpoints.NewInstance)
// 	registerShadowsocksPacketListener(c.PacketListeners, "ss", c.PacketEndpoints.NewInstance)
// 	registerShadowsocksPacketListener(c.PacketListeners, "string", c.PacketEndpoints.NewInstance)
// 	return c
// }

func NewDefaultTransportProvider() *TypeProvider[*TransportPair] {
	var streamEndpoints *TypeProvider[*Endpoint[transport.StreamConn]]
	var packetEndpoints *TypeProvider[*Endpoint[net.Conn]]

	streamDialers := NewTypeProvider(func(ctx context.Context, input any) (*Dialer[transport.StreamConn], error) {
		if input == nil {
			return &Dialer[transport.StreamConn]{ConnectionProviderInfo{ConnTypeDirect, ""}, (&transport.TCPDialer{}).DialStream}, nil
		}
		return newShadowsocksStreamDialer(ctx, input, streamEndpoints.NewInstance)
	})

	packetDialers := NewTypeProvider(func(ctx context.Context, input any) (*Dialer[net.Conn], error) {
		if input == nil {
			return &Dialer[net.Conn]{ConnectionProviderInfo{ConnTypeDirect, ""}, (&transport.UDPDialer{}).DialPacket}, nil
		}
		return newShadowsocksPacketDialer(ctx, input, packetEndpoints.NewInstance)
	})

	streamEndpoints = NewTypeProvider(func(ctx context.Context, input any) (*Endpoint[transport.StreamConn], error) {
		return newDirectDialerEndpoint(ctx, input, streamDialers.NewInstance)
	})
	streamEndpoints.RegisterParser("dial", func(ctx context.Context, input map[string]any) (*Endpoint[transport.StreamConn], error) {
		return newDirectDialerEndpoint(ctx, input, streamDialers.NewInstance)
	})

	packetEndpoints = NewTypeProvider(func(ctx context.Context, input any) (*Endpoint[net.Conn], error) {
		return newDirectDialerEndpoint(ctx, input, packetDialers.NewInstance)
	})
	packetEndpoints.RegisterParser("dial", func(ctx context.Context, input map[string]any) (*Endpoint[net.Conn], error) {
		return newDirectDialerEndpoint(ctx, input, packetDialers.NewInstance)
	})

	transports := NewTypeProvider(func(ctx context.Context, input any) (*TransportPair, error) {
		return newShadowsocksTransport(ctx, input, streamEndpoints.NewInstance, packetEndpoints.NewInstance)
	})

	// Shadowsocks support.
	streamDialers.RegisterParser("shadowsocks", func(ctx context.Context, input map[string]any) (*Dialer[transport.StreamConn], error) {
		return newShadowsocksStreamDialer(ctx, input, streamEndpoints.NewInstance)
	})
	packetDialers.RegisterParser("shadowsocks", func(ctx context.Context, input map[string]any) (*Dialer[net.Conn], error) {
		return newShadowsocksPacketDialer(ctx, input, packetEndpoints.NewInstance)
	})

	// Websocket support.
	streamEndpoints.RegisterParser("websocket", func(ctx context.Context, input map[string]any) (*Endpoint[transport.StreamConn], error) {
		// TODO
		return nil, errors.ErrUnsupported
	})
	packetEndpoints.RegisterParser("websocket", func(ctx context.Context, input map[string]any) (*Endpoint[net.Conn], error) {
		// TODO
		return nil, errors.ErrUnsupported
	})

	// TODO: Introduce explit transport parser.
	transports.RegisterParser("explicit", func(ctx context.Context, input map[string]any) (*TransportPair, error) {
		return nil, errors.ErrUnsupported
	})

	return transports
}
