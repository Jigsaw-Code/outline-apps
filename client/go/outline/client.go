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
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"

	cookiejar "github.com/juju/persistent-cookiejar"

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
	sd            *config.Dialer[transport.StreamConn]
	pl            *config.PacketListener
	reporter      reporting.Reporter
	sessionCancel context.CancelFunc
}

func (c *Client) DialStream(ctx context.Context, address string) (transport.StreamConn, error) {
	return c.sd.Dial(ctx, address)
}

func (c *Client) ListenPacket(ctx context.Context) (net.PacketConn, error) {
	return c.pl.ListenPacket(ctx)
}

func (c *Client) StartSession() error {
	slog.Debug("Starting session")
	var sessionCtx context.Context
	sessionCtx, c.sessionCancel = context.WithCancel(context.Background())
	go c.reporter.Run(sessionCtx)
	return nil
}

func (c *Client) EndSession() error {
	slog.Debug("Ending session")
	c.sessionCancel()
	return nil
}

// ClientConfig is used to create the Client.
type ClientConfig struct {
	Transport configyaml.ConfigNode
	Reporter  configyaml.ConfigNode
}

// NewClientResult represents the result of [NewClientAndReturnError].
//
// We use a struct instead of a tuple to preserve a strongly typed error that gobind recognizes.
type NewClientResult struct {
	Client *Client
	Error  *platerrors.PlatformError
}

// NewClient creates a new Outline client from a configuration string.
func NewClient(keyID string, dataDir string, clientConfig string) *NewClientResult {
	tcpDialer := transport.TCPDialer{Dialer: net.Dialer{KeepAlive: -1}}
	udpDialer := transport.UDPDialer{}
	client, err := NewClientWithBaseDialers(keyID, dataDir, clientConfig, &tcpDialer, &udpDialer)
	if err != nil {
		return &NewClientResult{Error: platerrors.ToPlatformError(err)}
	}
	return &NewClientResult{Client: client}
}

// TODO(fortuna): Refactor into a ClientOptions.New(configText) (*Client, error).
func NewClientWithBaseDialers(keyID string, dataDir string, clientConfigText string, tcpDialer transport.StreamDialer, udpDialer transport.PacketDialer) (*Client, error) {
	slog.Info("New Client", "keyID", keyID, "dataDir", dataDir)
	// if dataDir == "" {
	// 	return nil, &platerrors.PlatformError{
	// 		Code:    platerrors.InternalError,
	// 		Message: "data directory missing",
	// 	}
	// }

	var clientConfig ClientConfig
	if err := yaml.Unmarshal([]byte(clientConfigText), &clientConfig); err != nil {
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

	client := &Client{sd: transportPair.StreamDialer, pl: transportPair.PacketListener}
	// TODO: figure out a better way to handle parse calls.
	if dataDir != "" && clientConfig.Reporter != nil {
		serviceDir := path.Join(dataDir, "services", keyID)
		// Create serviceDir
		if err := os.MkdirAll(serviceDir, 0700); err != nil {
			return nil, fmt.Errorf("failed to create service data directory: %v", err)
		}
		cookieFilename := path.Join(serviceDir, "cookies.json")
		cookieJar, err := cookiejar.New(&cookiejar.Options{
			Filename: cookieFilename,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create cookie jar: %v", err)
		}
		httpClient := &http.Client{
			Transport: &http.Transport{
				DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
					if strings.HasPrefix(network, "tcp") {
						return client.DialStream(ctx, addr)
					} else {
						return nil, fmt.Errorf("protocol not supported: %v", network)
					}
				},
			},
			Jar: &logCookieJar{cookieJar},
		}
		reporter, err := NewReporterParser(httpClient).Parse(context.Background(), clientConfig.Reporter)
		if err != nil {
			return nil, &platerrors.PlatformError{
				Code:    platerrors.InvalidConfig,
				Message: "invalid reporter config",
				Cause:   platerrors.ToPlatformError(err),
			}
		}
		client.reporter = reporter
	}

	return client, nil
}

func NewReporterParser(httpClient *http.Client) *configyaml.TypeParser[reporting.Reporter] {
	parser := configyaml.NewTypeParser(func(ctx context.Context, input configyaml.ConfigNode) (reporting.Reporter, error) {
		return nil, errors.New("parser not specified")
	})
	parser.RegisterSubParser("first-supported", config.NewFirstSupportedSubParser(parser.Parse))
	parser.RegisterSubParser("http", reporting.NewHTTPReporterSubParser(httpClient))
	return parser
}

// type cookieRoundTripper struct {
// 	http.RoundTripper
// 	jar *cookiejar.Jar
// }

// func (c *cookieRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
// 	defer func() {
// 		if err := c.jar.Save(); err != nil {
// 			slog.Info("Failed to save cookies", "err", err)
// 		} else {
// 			slog.Info("Cookied saved successfully")
// 		}
// 	}()
// 	return c.RoundTripper.RoundTrip(req)
// }

// TODO: Remove
type logCookieJar struct {
	*cookiejar.Jar
}

func (c *logCookieJar) SetCookies(u *url.URL, cookies []*http.Cookie) {
	slog.Info("SetCookies", "url", u.String(), "cookies", cookies)
	c.Jar.SetCookies(u, cookies)
	c.Jar.Save()
	slog.Info("GetCookies after SetCookies", "url", u.String(), "cookies", c.Jar.Cookies(u))
}

func (c *logCookieJar) Cookies(u *url.URL) []*http.Cookie {
	cookies := c.Jar.Cookies(u)
	slog.Info("GetCookies", "url", u.String(), "cookies", cookies)
	return cookies
}
