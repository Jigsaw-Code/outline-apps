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
	"github.com/Jigsaw-Code/outline-sdk/network/lwip2transport"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

// RemoteDevice is an IO device that connects to a remote Outline server.
type RemoteDevice struct {
	io.ReadWriteCloser

	sd  transport.StreamDialer
	pp  network.PacketProxy
	dns *DNSInterceptor

	// health check fields
	tcpMu        sync.Mutex
	tcpCheckDone sync.WaitGroup
	tcpErr       error
}

func ConnectRemoteDevice(
	ctx context.Context,
	sd transport.StreamDialer,
	pl transport.PacketListener,
	dns *DNSInterceptor,
) (_ *RemoteDevice, err error) {
	if sd == nil {
		return nil, errors.New("StreamDialer must be provided")
	}
	if pl == nil {
		return nil, errors.New("PacketListener must be provided")
	}
	if dns == nil {
		return nil, errors.New("DNS interceptor must be provided")
	}
	if ctx.Err() != nil {
		return nil, errCancelled(ctx.Err())
	}

	dev := &RemoteDevice{dns: dns}

	if dev.sd, err = dns.NewStreamDialer(sd); err != nil {
		return nil, errSetupHandler("failed to create TCP handler", err)
	}
	slog.Debug("remote device TCP handler created")

	pp, err := network.NewPacketProxyFromPacketListener(pl)
	if err != nil {
		return nil, errSetupHandler("failed to create UDP handler (internal)", err)
	}
	slog.Debug("remote device UDP handler (internal) created")

	if dev.pp, err = dns.NewPacketProxy(pp); err != nil {
		return nil, errSetupHandler("failed to create UDP handler", err)
	}
	slog.Debug("remote device UDP handler created")

	dev.tcpCheckDone.Go(dev.checkTCPHealthAndUpdate)

	dev.ReadWriteCloser, err = lwip2transport.ConfigureDevice(dev.sd, dev.pp)
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
	d.tcpCheckDone.Wait()
	d.tcpMu.Lock()
	defer d.tcpMu.Unlock()
	return d.tcpErr
}

// NotifyNetworkChanged notifies the device that the underlying network has changed.
// It will re-test the UDP connectivity and update its UDP handler accordingly.
func (d *RemoteDevice) NotifyNetworkChanged() {
	d.dns.OnNotifyNetworkChanged()
}

func (d *RemoteDevice) checkTCPHealthAndUpdate() {
	slog.Debug("remote device is checking TCP health status...")
	err := connectivity.CheckTCPConnectivity(d.sd)

	d.tcpMu.Lock()
	defer d.tcpMu.Unlock()
	if d.tcpErr = err; d.tcpErr == nil {
		slog.Info("remote device TCP is healthy")
	} else {
		slog.Warn("remote device TCP is not healthy", "err", d.tcpErr)
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
