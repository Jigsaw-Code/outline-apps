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
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"runtime"
	"sync"
	"time"

	"github.com/Jigsaw-Code/outline-sdk/transport"
	"github.com/coder/websocket"
)

type WebsocketEndpointConfig struct {
	URL string
}

func parseWebsocketStreamEndpoint(ctx context.Context, configMap map[string]any, httpClient *http.Client) (*Endpoint[transport.StreamConn], error) {
	return parseWebsocketEndpoint(ctx, configMap, httpClient, func(wsConn *websocket.Conn) transport.StreamConn {
		return &wsToStreamConn{wsConn: wsConn}
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

// wsToStreamConn converts a [websocket.Conn] to a [transport.StreamConn].
type wsToStreamConn struct {
	wsConn     *websocket.Conn
	reader     io.Reader
	writer     io.WriteCloser
	readerErr  error
	writerErr  error
	readerOnce sync.Once
	writerOnce sync.Once
}

var _ transport.StreamConn = (*wsToStreamConn)(nil)

func (c *wsToStreamConn) LocalAddr() net.Addr {
	return websocketAddr{}
}

func (c *wsToStreamConn) RemoteAddr() net.Addr {
	return websocketAddr{}
}

func (c *wsToStreamConn) SetDeadline(time.Time) error {
	return errors.ErrUnsupported
}

func (c *wsToStreamConn) SetReadDeadline(time.Time) error {
	return errors.ErrUnsupported
}

func (c *wsToStreamConn) Read(buf []byte) (int, error) {
	c.readerOnce.Do(func() {
		// We use a single message with unbounded size for the entire TCP stream.
		c.wsConn.SetReadLimit(-1)
		msgType, reader, err := c.wsConn.Reader(context.Background())
		if err != nil {
			c.readerErr = fmt.Errorf("failed to get websocket reader: %w", err)
			return
		}
		if msgType != websocket.MessageBinary {
			c.readerErr = errors.New("message type is not binary")
			return
		}
		c.reader = reader
	})
	if c.readerErr != nil {
		return 0, c.readerErr
	}
	return c.reader.Read(buf)
}

func (c *wsToStreamConn) CloseRead() error {
	c.wsConn.CloseRead(context.Background())
	return nil
}

func (c *wsToStreamConn) SetWriteDeadline(time.Time) error {
	return errors.ErrUnsupported
}

func (c *wsToStreamConn) Write(buf []byte) (int, error) {
	c.writerOnce.Do(func() {
		writer, err := c.wsConn.Writer(context.Background(), websocket.MessageBinary)
		if err != nil {
			c.writerErr = fmt.Errorf("failed to get websocket reader: %w", err)
			return
		}
		c.writer = writer
	})
	if c.writerErr != nil {
		return 0, c.writerErr
	}
	return c.writer.Write(buf)
}

func (c *wsToStreamConn) CloseWrite() error {
	return c.writer.Close()
}

func (c *wsToStreamConn) Close() error {
	return c.wsConn.Close(websocket.StatusNormalClosure, "")
}

type websocketAddr struct {
}

func (a websocketAddr) Network() string {
	return "websocket"
}

func (a websocketAddr) String() string {
	return "websocket/unknown-addr"
}
