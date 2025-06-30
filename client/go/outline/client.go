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

	"github.com/Jigsaw-Code/outline-apps/client/go/configyaml"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/config"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/reporting"
	"github.com/Jigsaw-Code/outline-sdk/transport"
	"github.com/goccy/go-yaml"
)

// Client provides a transparent container for [transport.StreamDialer] and [transport.PacketListener]
// that is exportable (as an opaque object) via gobind.
// It's used by the connectivity test and the tun2socks handlers.
// TODO: Rename to Transport. Needs to update per-platform code.
type Client struct {
	sd     *config.Dialer[transport.StreamConn]
	pl     *config.PacketListener
	ur     *config.UsageReporter
	cancel context.CancelFunc // Used to stop reporting
}

func (c *Client) DialStream(ctx context.Context, address string) (transport.StreamConn, error) {
	return c.sd.Dial(ctx, address)
}

func (c *Client) ListenPacket(ctx context.Context) (net.PacketConn, error) {
	return c.pl.ListenPacket(ctx)
}

// ClientConfig is used to create the Client.
type ClientConfig struct {
	Transport configyaml.ConfigNode
}

// NewClientResult represents the result of [NewClientAndReturnError].
//
// We use a struct instead of a tuple to preserve a strongly typed error that gobind recognizes.
type NewClientResult struct {
	Client *Client
	Error  *platerrors.PlatformError
}

func (c *Client) StartReporting() {
	if c.ur == nil {
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	c.cancel = cancel // Store the cancel function to stop reporting later

	go reporting.StartReporting(ctx, c, c.ur)
}

func (c *Client) StopReporting() {
	if c.cancel != nil {
		c.cancel() // Signal the context to stop reporting
		c.cancel = nil
	}
}

// NewClient creates a new Client with the given clientConfig.
func NewClient(clientConfig string) *NewClientResult {
	return NewClientWithSession(clientConfig, "")
}

// NewClientWithSession creates a new Client with the given clientConfig and sessionConfig.
// A variadic function could be used to combine this function with NewClient, but it could
// not be used in the Java code, so we keep it separate.
func NewClientWithSession(clientConfig string, sessionConfig string) *NewClientResult {
	tcpDialer := transport.TCPDialer{Dialer: net.Dialer{KeepAlive: -1}}
	udpDialer := transport.UDPDialer{}
	client, err := NewClientFull(clientConfig, sessionConfig, &tcpDialer, &udpDialer)
	if err != nil {
		return &NewClientResult{Error: platerrors.ToPlatformError(err)}
	}
	return &NewClientResult{Client: client}
}

// NewClientWithBaseDialers creates a new Client with the given clientConfig and base dialers.
func NewClientWithBaseDialers(clientConfigText string, tcpDialer transport.StreamDialer, udpDialer transport.PacketDialer) (*Client, error) {
	return NewClientFull(clientConfigText, "", tcpDialer, udpDialer)
}

// The main function with all arguments:
func NewClientFull(clientConfigText string, sessionConfig string, tcpDialer transport.StreamDialer, udpDialer transport.PacketDialer) (*Client, error) {
	var clientConfig ClientConfig
	err := yaml.Unmarshal([]byte(clientConfigText), &clientConfig)
	if err != nil {
		return nil, &platerrors.PlatformError{
			Code:    platerrors.InvalidConfig,
			Message: "config is not valid YAML",
			Cause:   platerrors.ToPlatformError(err),
		}
	}

	transportPair, err := config.NewDefaultTransportProvider(tcpDialer, udpDialer).Parse(context.Background(), clientConfig.Transport)
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

	// Make sure the transport is not proxyless for now.
	if transportPair.StreamDialer.ConnType == config.ConnTypeDirect {
		return nil, &platerrors.PlatformError{
			Code:    platerrors.InvalidConfig,
			Message: "transport must tunnel TCP traffic",
		}
	}
	if transportPair.PacketListener.ConnType == config.ConnTypeDirect {
		return nil, &platerrors.PlatformError{
			Code:    platerrors.InvalidConfig,
			Message: "transport must tunnel UDP traffic",
		}
	}

	var usageReporter *config.UsageReporter
	if sessionConfig != "" {
		usageReportYAML, err := configyaml.ParseConfigYAML(sessionConfig)
		if err != nil {
			return nil, &platerrors.PlatformError{
				Code:    platerrors.InvalidConfig,
				Message: "client config is not valid YAML",
				Cause:   platerrors.ToPlatformError(err),
			}
		}
		usageReporter, err = config.NewUsageReportProvider().Parse(context.Background(), usageReportYAML)
		if err != nil {
			if errors.Is(err, errors.ErrUnsupported) {
				return nil, &platerrors.PlatformError{
					Code:    platerrors.InvalidConfig,
					Message: "unsupported client config",
					Cause:   platerrors.ToPlatformError(err),
				}
			} else {
				return nil, &platerrors.PlatformError{
					Code:    platerrors.InvalidConfig,
					Message: "failed to create usage report",
					Cause:   platerrors.ToPlatformError(err),
				}
			}
		}
	}

	return &Client{sd: transportPair.StreamDialer, pl: transportPair.PacketListener, ur: usageReporter}, nil
}
