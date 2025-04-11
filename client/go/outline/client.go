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
	"fmt"
	"net"

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
	sd *config.Dialer[transport.StreamConn]
	pl *config.PacketListener
}

type SessionClient struct {
	ur *config.UsageReporter
}

func (c *Client) Connect() {
	// TODO: only report if transportConfig is configured to report.
	// tcpDialer := transport.TCPDialer{Dialer: net.Dialer{KeepAlive: -1}}
	reporting.StartReporting(c)
}

func (c *Client) Disconnect() {
	// TODO: reporting.StopReporting()
}

func (c *Client) DialStream(ctx context.Context, address string) (transport.StreamConn, error) {
	return c.sd.Dial(ctx, address)
}

func (c *Client) ListenPacket(ctx context.Context) (net.PacketConn, error) {
	return c.pl.ListenPacket(ctx)
}

type UsageReportingClient struct {
	sd                  *config.Dialer[transport.StreamConn]
	usageReporterConfig *config.UsageReporter
}

// NewClientResult represents the result of [NewClientAndReturnError].
//
// We use a struct instead of a tuple to preserve a strongly typed error that gobind recognizes.
type NewClientResult struct {
	Client *Client
	Error  *platerrors.PlatformError
}

type NewSessionClientResult struct {
	SessionClient *SessionClient
	Error         *platerrors.PlatformError
}

func NewSessionClient(transportAndSessionConfig string, dialer transport.StreamDialer) *NewSessionClientResult {
	usageReporter, err := NewUsageReportWithBaseDialers(transportAndSessionConfig, dialer)
	if err != nil {
		return &NewSessionClientResult{Error: platerrors.ToPlatformError(err)}
	}
	sessionClient := &SessionClient{
		ur: usageReporter,
	}
	return &NewSessionClientResult{SessionClient: sessionClient}
}

// NewClient creates a new Outline client from a configuration string.
func NewClient(transportConfig string) *NewClientResult {
	tcpDialer := transport.TCPDialer{Dialer: net.Dialer{KeepAlive: -1}}
	udpDialer := transport.UDPDialer{}
	client, err := NewClientWithBaseDialers(transportConfig, &tcpDialer, &udpDialer)
	if err != nil {
		return &NewClientResult{Error: platerrors.ToPlatformError(err)}
	}
	return &NewClientResult{Client: client}
}

func NewClientWithBaseDialers(transportConfig string, tcpDialer transport.StreamDialer, udpDialer transport.PacketDialer) (*Client, error) {
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

	return &Client{sd: transportPair.StreamDialer, pl: transportPair.PacketListener}, nil
}

func NewUsageReportWithBaseDialers(transportAndSessionConfig string, tcpDialer transport.StreamDialer) (*config.UsageReporter, error) {
	var yamlValue map[string]any
	if err := yaml.Unmarshal([]byte(transportAndSessionConfig), &yamlValue); err != nil {
		return nil, &platerrors.PlatformError{
			Code:    platerrors.InvalidConfig,
			Message: "config is not valid YAML",
			Cause:   platerrors.ToPlatformError(err),
		}
	}
	fmt.Println("yamlValue: ", yamlValue)
	// if !hasKey(yamlValue, "usage_report") {
	// 	return nil, nil
	// }
	usageReportYAML, err := config.ParseConfigYAML(transportAndSessionConfig)
	if err != nil {
		return nil, &platerrors.PlatformError{
			Code:    platerrors.InvalidConfig,
			Message: "config is not valid YAML",
			Cause:   platerrors.ToPlatformError(err),
		}
	}
	usageReporter, err := config.NewUsageReportProvide(tcpDialer).Parse(context.Background(), usageReportYAML)
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
				Message: "failed to create usage report",
				Cause:   platerrors.ToPlatformError(err),
			}
		}
	}
	fmt.Println("usageReporter", usageReporter)
	return usageReporter, nil
}
