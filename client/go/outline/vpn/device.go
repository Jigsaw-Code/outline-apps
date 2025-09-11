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
	"sync"

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

	// health check fields
	hcDone sync.WaitGroup
	hcErr  error
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
	if dev.pkt, err = network.NewDelegatePacketProxy(dev.fallback); err != nil {
		return nil, errSetupHandler("failed to create combined UDP handler", err)
	}

	dev.hcDone.Go(dev.checkTCPHealthAndUpdate)
	go dev.checkUDPHealthAndUpdate()

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

func (d *RemoteDevice) GetHealthStatus() error {
	d.hcDone.Wait()
	return d.hcErr
}

// NotifyNetworkChanged notifies the device that the underlying network has changed.
// It will re-test the UDP connectivity and update its UDP handler accordingly.
func (d *RemoteDevice) NotifyNetworkChanged() {
	go d.checkUDPHealthAndUpdate()
}

func (d *RemoteDevice) checkTCPHealthAndUpdate() {
	slog.Debug("remote device is checking TCP health status...")
	if d.hcErr = connectivity.CheckTCPConnectivity(d.sd); d.hcErr == nil {
		slog.Info("remote device TCP is healthy")
	} else {
		slog.Warn("remote device TCP is not healthy", "err", d.hcErr)
	}
}

func (d *RemoteDevice) checkUDPHealthAndUpdate() error {
	if err := connectivity.CheckUDPConnectivity(d.pl); err == nil {
		slog.Info("remote device UDP is healthy")
		return d.pkt.SetProxy(d.remote)
	} else {
		slog.Warn("remote device UDP is not healthy", "err", err)
		return d.pkt.SetProxy(d.fallback)
	}
}

func errSetupHandler(msg string, cause error) error {
	slog.Error(msg, "err", cause)
	return perrs.PlatformError{
		Code:    perrs.SetupTrafficHandlerFailed,
		Message: msg,
		Cause:   perrs.ToPlatformError(cause),
	}
}
