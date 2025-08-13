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

package vpn

import (
	"context"
	"errors"
	"io"
	"log/slog"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/connectivity"
	perrs "github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-sdk/network"
	"github.com/Jigsaw-Code/outline-sdk/network/dnstruncate"
	"github.com/Jigsaw-Code/outline-sdk/network/lwip2transport"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

// RemoteDevice is an IO device that connects to a remote Outline server.
type RemoteDevice struct {
	io.ReadWriteCloser

	sd transport.StreamDialer
	pl transport.PacketListener

	pkt              network.DelegatePacketProxy
	remote, fallback network.PacketProxy
}

func ConnectRemoteDevice(
	ctx context.Context, sd transport.StreamDialer, pl transport.PacketListener,
) (_ *RemoteDevice, err error) {
	if sd == nil {
		return nil, errors.New("StreamDialer must be provided")
	}
	if pl == nil {
		return nil, errors.New("PacketListener must be provided")
	}
	if ctx.Err() != nil {
		return nil, errCancelled(ctx.Err())
	}

	dev := &RemoteDevice{sd: sd, pl: pl}

	dev.remote, err = network.NewPacketProxyFromPacketListener(pl)
	if err != nil {
		return nil, errSetupHandler("failed to create remote UDP handler", err)
	}
	slog.Debug("remote device remote UDP handler created")

	if dev.fallback, err = dnstruncate.NewPacketProxy(); err != nil {
		return nil, errSetupHandler("failed to create UDP handler for DNS-fallback", err)
	}
	slog.Debug("remote device local DNS-fallback UDP handler created")

	if err = dev.RefreshConnectivity(ctx); err != nil {
		return
	}

	dev.ReadWriteCloser, err = lwip2transport.ConfigureDevice(sd, dev.pkt)
	if err != nil {
		return nil, errSetupHandler("remote device failed to configure network stack", err)
	}
	slog.Debug("remote device lwIP network stack configured")

	return dev, nil
}

// Close closes the connection to the Outline server.
func (dev *RemoteDevice) Close() (err error) {
	if dev.ReadWriteCloser != nil {
		err = dev.ReadWriteCloser.Close()
	}
	return
}

// RefreshConnectivity refreshes the connectivity to the Outline server.
func (d *RemoteDevice) RefreshConnectivity(ctx context.Context) (err error) {
	if ctx.Err() != nil {
		return errCancelled(ctx.Err())
	}

	slog.Debug("remote device is testing connectivity of server...")
	tcpErr, udpErr := connectivity.CheckTCPAndUDPConnectivity(d.sd, d.pl)
	if tcpErr != nil {
		slog.Warn("remote device server connectivity test failed", "err", tcpErr)
		return tcpErr
	}

	var proxy network.PacketProxy
	if udpErr != nil {
		slog.Warn("remote device server cannot handle UDP traffic", "err", udpErr)
		proxy = d.fallback
	} else {
		slog.Debug("remote device server can handle UDP traffic")
		proxy = d.remote
	}

	if d.pkt == nil {
		if d.pkt, err = network.NewDelegatePacketProxy(proxy); err != nil {
			return errSetupHandler("failed to create combined datagram handler", err)
		}
	} else {
		if err = d.pkt.SetProxy(proxy); err != nil {
			return errSetupHandler("failed to update combined datagram handler", err)
		}
	}

	slog.Info("remote device server connectivity test done", "supportsUDP", proxy == d.remote)
	return nil
}

func errSetupHandler(msg string, cause error) error {
	slog.Error(msg, "err", cause)
	return perrs.PlatformError{
		Code:    perrs.SetupTrafficHandlerFailed,
		Message: msg,
		Cause:   perrs.ToPlatformError(cause),
	}
}
