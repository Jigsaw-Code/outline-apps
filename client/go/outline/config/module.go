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

// TransportPair provides a StreamDialer and PacketListener, to use as the transport in a Tun2Socks VPN.
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

// NewDefaultTransportProvider provider a [TransportPair].
func NewDefaultTransportProvider(tcpDialer transport.StreamDialer, udpDialer transport.PacketDialer) *TypeParser[*TransportPair] {
	var streamEndpoints *TypeParser[*Endpoint[transport.StreamConn]]
	var packetEndpoints *TypeParser[*Endpoint[net.Conn]]

	streamDialers := NewTypeParser(func(ctx context.Context, input ConfigNode) (*Dialer[transport.StreamConn], error) {
		switch input.(type) {
		case nil:
			// An absent config implicitly means TCP.
			return &Dialer[transport.StreamConn]{ConnectionProviderInfo{ConnTypeDirect, ""}, tcpDialer.DialStream}, nil
		case string:
			// Parse URL-style config.
			return parseShadowsocksStreamDialer(ctx, input, streamEndpoints.Parse)
		default:
			return nil, errors.New("parser not specified")
		}
	})

	packetDialers := NewTypeParser(func(ctx context.Context, input ConfigNode) (*Dialer[net.Conn], error) {
		switch input.(type) {
		case nil:
			// An absent config implicitly means UDP.
			return &Dialer[net.Conn]{ConnectionProviderInfo{ConnTypeDirect, ""}, udpDialer.DialPacket}, nil
		case string:
			// Parse URL-style config.
			return parseShadowsocksPacketDialer(ctx, input, packetEndpoints.Parse)
		default:
			return nil, errors.New("parser not specified")
		}
	})

	packetListeners := NewTypeParser(func(ctx context.Context, input ConfigNode) (*PacketListener, error) {
		switch input.(type) {
		case nil:
			// An absent config implicitly means UDP.
			return &PacketListener{ConnectionProviderInfo{ConnTypeDirect, ""}, &transport.UDPListener{}}, nil
		default:
			return nil, errors.New("parser not specified")
		}
	})

	streamEndpoints = NewTypeParser(func(ctx context.Context, input ConfigNode) (*Endpoint[transport.StreamConn], error) {
		// TODO: perhaps only support string here to force the struct to have an explicit parser.
		return parseDirectDialerEndpoint(ctx, input, streamDialers.Parse)
	})
	streamEndpoints.RegisterSubParser("dial", func(ctx context.Context, input map[string]any) (*Endpoint[transport.StreamConn], error) {
		return parseDirectDialerEndpoint(ctx, input, streamDialers.Parse)
	})

	packetEndpoints = NewTypeParser(func(ctx context.Context, input ConfigNode) (*Endpoint[net.Conn], error) {
		return parseDirectDialerEndpoint(ctx, input, packetDialers.Parse)
	})
	packetEndpoints.RegisterSubParser("dial", func(ctx context.Context, input map[string]any) (*Endpoint[net.Conn], error) {
		return parseDirectDialerEndpoint(ctx, input, packetDialers.Parse)
	})

	transports := NewTypeParser(func(ctx context.Context, input ConfigNode) (*TransportPair, error) {
		// If parser directive is missing, parse as Shadowsocks for backwards-compatibility.
		return parseShadowsocksTransport(ctx, input, streamEndpoints.Parse, packetEndpoints.Parse)
	})

	// Shadowsocks support.
	streamDialers.RegisterSubParser("shadowsocks", func(ctx context.Context, input map[string]any) (*Dialer[transport.StreamConn], error) {
		return parseShadowsocksStreamDialer(ctx, input, streamEndpoints.Parse)
	})
	packetDialers.RegisterSubParser("shadowsocks", func(ctx context.Context, input map[string]any) (*Dialer[net.Conn], error) {
		return parseShadowsocksPacketDialer(ctx, input, packetEndpoints.Parse)
	})
	packetListeners.RegisterSubParser("shadowsocks", func(ctx context.Context, input map[string]any) (*PacketListener, error) {
		return parseShadowsocksPacketListener(ctx, input, packetEndpoints.Parse)
	})

	// TODO: Websocket support.
	// httpClient := http.DefaultClient
	// streamEndpoints.RegisterSubParser("websocket", func(ctx context.Context, input map[string]any) (*Endpoint[transport.StreamConn], error) {
	// 	return parseWebsocketStreamEndpoint(ctx, input, httpClient)
	// })
	// packetEndpoints.RegisterSubParser("websocket", func(ctx context.Context, input map[string]any) (*Endpoint[net.Conn], error) {
	// 	return parseWebsocketPacketEndpoint(ctx, input, httpClient)
	// })

	// Support distinct TCP and UDP configuration.
	transports.RegisterSubParser("tcpudp", func(ctx context.Context, config map[string]any) (*TransportPair, error) {
		return parseTCPUDPTransportPair(ctx, config, streamDialers.Parse, packetListeners.Parse)
	})

	return transports
}
