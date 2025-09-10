// Copyright 2019 The Outline Authors
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

package tun2socks

import (
	"context"
	"fmt"
	"io"
	"log/slog"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/vpn"
)

// TunWriter is an interface that allows for outputting packets to the TUN (VPN).
type TunWriter interface {
	io.WriteCloser
}

// ConnectOutlineTunnel reads packets from a TUN device and routes it to an Outline proxy server.
// Returns an OutlineTunnel instance that should be used to input packets to the tunnel.
//
// `tunWriter` is used to output packets to the TUN (VPN).
// `client` is the Outline client (created by [outline.NewClient]).
// `isAutoStart` indicates whether the tunnel is established as part of an auto-start workflow.
//
// Sets an error if the tunnel fails to connect.
//
// TODO(junyi): remove isAutoStart
func ConnectOutlineTunnel(tunWriter TunWriter, client *outline.Client, isAutoStart bool) *ConnectOutlineTunnelResult {
	if tunWriter == nil {
		return &ConnectOutlineTunnelResult{Error: &platerrors.PlatformError{
			Code:    platerrors.InternalError,
			Message: "must provide a TunWriter",
		}}
	} else if client == nil {
		return &ConnectOutlineTunnelResult{Error: &platerrors.PlatformError{
			Code:    platerrors.InternalError,
			Message: "must provide a client instance",
		}}
	}

	t, err := newRemoteDeviceTunnel(client, isAutoStart)
	if err != nil {
		return &ConnectOutlineTunnelResult{Error: &platerrors.PlatformError{
			Code:    platerrors.SetupTrafficHandlerFailed,
			Message: "failed to connect to remote server",
			Cause:   platerrors.ToPlatformError(err),
		}}
	}
	t.tun = tunWriter
	go vpn.RelayTraffic(t.tun, t.rd)

	return &ConnectOutlineTunnelResult{Tunnel: t}
}

type remoteDeviceTunnel struct {
	client    *outline.Client
	tun       TunWriter
	rd        *vpn.RemoteDevice
	connected bool
}

var _ Tunnel = (*remoteDeviceTunnel)(nil)

func newRemoteDeviceTunnel(client *outline.Client, isAutoStart bool) (t *remoteDeviceTunnel, err error) {
	if err := client.StartSession(); err != nil {
		return nil, fmt.Errorf("failed to start backend Client session: %w", err)
	}
	defer func() {
		if err != nil {
			client.EndSession()
		}
	}()
	rd, err := vpn.ConnectRemoteDevice(context.Background(), client, client)
	if err != nil {
		return nil, err
	}
	if !isAutoStart {
		if err := rd.GetHealthStatus(); err != nil {
			slog.Warn("remote device is not healthy", "err", err)
			return nil, err
		}
	} else {
		slog.Info("skip health check due to auto-start")
	}
	return &remoteDeviceTunnel{
		client:    client,
		rd:        rd,
		connected: true,
	}, nil
}

func (t *remoteDeviceTunnel) IsConnected() bool {
	return t.connected
}

func (t *remoteDeviceTunnel) Disconnect() {
	t.connected = false
	t.tun.Close()
	t.rd.Close()
	if t.client != nil {
		if err := t.client.EndSession(); err != nil {
			slog.Error("failed to end backend Client session", "err", err)
		}
		t.client = nil
	}
}

func (t *remoteDeviceTunnel) Write(data []byte) (int, error) {
	return t.rd.Write(data)
}

func (t *remoteDeviceTunnel) UpdateUDPSupport() bool {
	t.rd.NotifyNetworkChanged()
	return false /* dummy value, should not be used */
}
