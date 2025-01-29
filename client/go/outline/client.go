// Copyright 2023 The Outline Authors
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

package outline

import (
	"context"
	"errors"
	"net"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/config"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

// Client provides a transparent container for [transport.StreamDialer] and [transport.PacketListener]
// that is exportable (as an opaque object) via gobind.
// It's used by the connectivity test and the tun2socks handlers.
// TODO: Rename to Transport. Needs to update per-platform code.
type Client struct {
	sd *config.Dialer[transport.StreamConn]
	pl *config.PacketListener
}

func (c *Client) DialStream(ctx context.Context, address string) (transport.StreamConn, error) {
	return c.sd.Dial(ctx, address)
}

func (c *Client) ListenPacket(ctx context.Context) (net.PacketConn, error) {
	return c.pl.ListenPacket(ctx)
}

// NewClientResult represents the result of [NewClientAndReturnError].
//
// We use a struct instead of a tuple to preserve a strongly typed error that gobind recognizes.
type NewClientResult struct {
	Client *Client
	Error  *platerrors.PlatformError
}

// NewClient creates a new Outline client from a configuration string.
func NewClient(transportConfig string) *NewClientResult {
	tcpDialer := transport.TCPDialer{Dialer: net.Dialer{KeepAlive: -1}}
	udpDialer := transport.UDPDialer{}
	client, err := newClientWithBaseDialers(transportConfig, &tcpDialer, &udpDialer)
	if err != nil {
		return &NewClientResult{Error: platerrors.ToPlatformError(err)}
	}
	return &NewClientResult{Client: client}
}

func newClientWithBaseDialers(transportConfig string, tcpDialer transport.StreamDialer, udpDialer transport.PacketDialer) (*Client, error) {
	transportYAML, err := config.ParseConfigYAML(transportConfig)
	if err != nil {
		return nil, &platerrors.PlatformError{
			Code:    platerrors.InvalidConfig,
			Message: "config is not valid YAML",
			Cause:   platerrors.ToPlatformError(err),
		}
	}

	transportPair, err := config.NewDefaultTransportProvider(tcpDialer, udpDialer).Parse(context.Background(), transportYAML)
	if err != nil {
		if errors.Is(err, errors.ErrUnsupported) {
			return nil, &platerrors.PlatformError{
				Code:    platerrors.InvalidConfig,
				Message: "unsupported config",
				Cause:   platerrors.ToPlatformError(err),
			}
		} else {
			return nil, &platerrors.PlatformError{
				Code:    platerrors.InvalidConfig,
				Message: "failed to create transport",
				Cause:   platerrors.ToPlatformError(err),
			}
		}
	}

	return &Client{sd: transportPair.StreamDialer, pl: transportPair.PacketListener}, nil
}
