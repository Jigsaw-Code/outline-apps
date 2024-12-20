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

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/config"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

// Client provides a transparent container for [transport.StreamDialer] and [transport.PacketListener]
// that is exportable (as an opaque object) via gobind.
// It's used by the connectivity test and the tun2socks handlers.
type Client struct {
	*config.Dialer[transport.StreamConn]
	*config.PacketListener
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
	transportYAML, err := config.ParseConfigYAML(transportConfig)
	if err != nil {
		return &NewClientResult{
			Error: &platerrors.PlatformError{
				Code:    platerrors.IllegalConfig,
				Message: "config is not valid YAML",
				Cause:   platerrors.ToPlatformError(err),
			},
		}
	}

	providers := config.RegisterDefaultProviders(config.NewProviderContainer())

	streamDialer, err := providers.StreamDialers.NewInstance(context.Background(), transportYAML)
	if err != nil {
		return &NewClientResult{
			Error: &platerrors.PlatformError{
				Code:    platerrors.IllegalConfig,
				Message: "failed to create TCP handler",
				Details: platerrors.ErrorDetails{"handler": "tcp"},
				Cause:   platerrors.ToPlatformError(err),
			},
		}
	}

	packetListener, err := providers.PacketListeners.NewInstance(context.Background(), transportYAML)
	if err != nil {
		return &NewClientResult{
			Error: &platerrors.PlatformError{
				Code:    platerrors.IllegalConfig,
				Message: "failed to create UDP handler",
				Details: platerrors.ErrorDetails{"handler": "udp"},
				Cause:   platerrors.ToPlatformError(err),
			},
		}
	}

	return &NewClientResult{
		Client: &Client{Dialer: streamDialer, PacketListener: packetListener},
	}
}
