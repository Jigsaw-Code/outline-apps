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
	"log/slog"
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
// TODO(fortuna):
//   - Add connectivity test to StartSession()
//   - Add NotifyNetworkChange() method. Needs to hold a network.PacketProxy instead of config.PacketListener
//     to handle that.
//   - Refactor so that StartSession returns a Client
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

func (c *Client) StartSession() error {
	slog.Debug("Starting session")
	return nil
}

func (c *Client) EndSession() error {
	slog.Debug("Ending session")
	return nil
}

// ClientConfig is used to create the Client.
type ClientConfig struct {
	Transport       configyaml.ConfigNode
	ReportingConfig configyaml.ConfigNode `yaml:"report,omitempty"`
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

func NewClient(clientConfig string) *NewClientResult {
	tcpDialer := transport.TCPDialer{Dialer: net.Dialer{KeepAlive: -1}}
	udpDialer := transport.UDPDialer{}
	client, err := NewClientWithBaseDialers(clientConfig, &tcpDialer, &udpDialer)
	if err != nil {
		return &NewClientResult{Error: platerrors.ToPlatformError(err)}
	}
	return &NewClientResult{Client: client}
}

// NewClientWithBaseDialers creates a new Client with the given clientConfig and base dialers.
func NewClientWithBaseDialers(clientConfigText string, tcpDialer transport.StreamDialer, udpDialer transport.PacketDialer) (*Client, error) {
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
	if clientConfig.ReportingConfig != nil {
		usageReporter, err = config.NewUsageReportProvider().Parse(context.Background(), clientConfig.ReportingConfig)
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

// Get the reporting server
func (c *Client) Getur() *config.UsageReporter {
	return c.ur
}

// Set the Key ID (Server UUID)
func (c *Client) SetKeyId(keyId string) {
	if c.ur != nil {
		c.ur.KeyId = keyId
	}
}

// This interface can be used by various other modules to call the Go code set the cookie file path.
func (c *Client) SetCookieFilePath(path string) {
	go reporting.SetCookieFilePath(path)
}
