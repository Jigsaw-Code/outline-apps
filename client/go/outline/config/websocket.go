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
	"fmt"
	"net"
	"net/http"
	"net/url"
	"runtime"

	"github.com/Jigsaw-Code/outline-sdk/transport"
	"github.com/coder/websocket"
)

type WebsocketEndpointConfig struct {
	URL string
}

func parseWebsocketStreamEndpoint(ctx context.Context, configMap map[string]any, httpClient *http.Client) (*Endpoint[transport.StreamConn], error) {
	return parseWebsocketEndpoint(ctx, configMap, httpClient, func(c *websocket.Conn) transport.StreamConn {
		return &netToStreamConn{websocket.NetConn(context.Background(), c, websocket.MessageBinary)}
	})
}

func parseWebsocketPacketEndpoint(ctx context.Context, configMap map[string]any, httpClient *http.Client) (*Endpoint[net.Conn], error) {
	return parseWebsocketEndpoint(ctx, configMap, httpClient, func(c *websocket.Conn) net.Conn {
		return websocket.NetConn(context.Background(), c, websocket.MessageBinary)
	})
}

func parseWebsocketEndpoint[ConnType any](_ context.Context, configMap map[string]any, httpClient *http.Client, wsToConn func(*websocket.Conn) ConnType) (*Endpoint[ConnType], error) {
	var config WebsocketEndpointConfig
	if err := mapToAny(configMap, &config); err != nil {
		return nil, fmt.Errorf("invalid config format: %w", err)
	}

	url, err := url.Parse(config.URL)
	if err != nil {
		return nil, fmt.Errorf("url is invalid: %w", err)
	}

	port := url.Port()
	if port == "" {
		switch url.Scheme {
		case "https", "wss":
			port = "443"
		case "http", "ws":
			port = "80"
		}
	}

	options := &websocket.DialOptions{
		HTTPClient: httpClient,
		HTTPHeader: http.Header(map[string][]string{"User-Agent": {fmt.Sprintf("Outline (%s; %s; %s)", runtime.GOOS, runtime.GOARCH, runtime.Version())}}),
	}
	return &Endpoint[ConnType]{
		ConnectionProviderInfo: ConnectionProviderInfo{ConnType: ConnTypeDirect, FirstHop: net.JoinHostPort(url.Hostname(), port)},
		Connect: func(ctx context.Context) (ConnType, error) {
			var zero ConnType
			conn, _, err := websocket.Dial(ctx, config.URL, options)

			if err != nil {
				return zero, err
			}
			return wsToConn(conn), nil
		},
	}, nil
}

// netToStreamConn converts a [net.Conn] to a [transport.StreamConn].
type netToStreamConn struct {
	net.Conn
}

var _ transport.StreamConn = (*netToStreamConn)(nil)

func (c *netToStreamConn) CloseRead() error {
	// Do nothing.
	return nil
}

func (c *netToStreamConn) CloseWrite() error {
	return c.Close()
}
