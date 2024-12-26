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

// Transport provides a transparent container for [transport.StreamDialer] and [transport.PacketListener]
// that is exportable (as an opaque object) via gobind.
// It's used by the connectivity test and the tun2socks handlers.
type Transport struct {
	*config.Dialer[transport.StreamConn]
	*config.PacketListener
}

// NewTransportResult represents the result of [NewClientAndReturnError].
//
// We use a struct instead of a tuple to preserve a strongly typed error that gobind recognizes.
type NewTransportResult struct {
	Transport *Transport
	Error     *platerrors.PlatformError
}

// NewTransport creates a new Outline client from a configuration string.
func NewTransport(transportConfig string) *NewTransportResult {
	transportYAML, err := config.ParseConfigYAML(transportConfig)
	if err != nil {
		return &NewTransportResult{
			Error: &platerrors.PlatformError{
				Code:    platerrors.IllegalConfig,
				Message: "config is not valid YAML",
				Cause:   platerrors.ToPlatformError(err),
			},
		}
	}

	transportPair, err := config.NewDefaultTransportProvider().Parse(context.Background(), transportYAML)
	if err != nil {
		return &NewTransportResult{
			Error: &platerrors.PlatformError{
				Code:    platerrors.IllegalConfig,
				Message: "failed to create transport",
				Cause:   platerrors.ToPlatformError(err),
			},
		}
	}

	return &NewTransportResult{
		Transport: &Transport{Dialer: transportPair.StreamDialer, PacketListener: transportPair.PacketListener},
	}
}
