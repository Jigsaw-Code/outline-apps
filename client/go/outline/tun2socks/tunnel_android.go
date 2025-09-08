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
	"errors"
	"fmt"
	"log/slog"
	"os"
	"runtime/debug"
	"sync"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/vpn"
	_ "github.com/eycorsican/go-tun2socks/common/log/simple" // Import simple log for the side effect of making logs printable.
	"golang.org/x/sys/unix"
)

func init() {
	// Conserve memory by increasing garbage collection frequency.
	debug.SetGCPercent(10)
}

// ConnectOutlineTunnel reads packets from a TUN device and routes it to an Outline proxy server.
// Returns an OutlineTunnel instance and does *not* take ownership of the TUN file descriptor; the
// caller is responsible for closing after OutlineTunnel disconnects.
//
//   - `fd` is the TUN device.  The OutlineTunnel acquires an additional reference to it, which
//     is released by OutlineTunnel.Disconnect(), so the caller must close `fd` _and_ call
//     Disconnect() in order to close the TUN device.
//   - `client` is the Outline client (created by [outline.NewClient]).
//   - `isAutoStart` indicates whether the tunnel is established as part of an auto-start workflow.
//
// Returns an error if the TUN file descriptor cannot be opened, or if the tunnel fails to
// connect.
//
// TODO(junyi): remove isAutoStart
func ConnectOutlineTunnel(fd int, client *outline.Client, isAutoStart bool) *ConnectOutlineTunnelResult {
	tun, err := makeTunFile(fd)
	if err != nil {
		return &ConnectOutlineTunnelResult{Error: &platerrors.PlatformError{
			Code:    platerrors.SetupSystemVPNFailed,
			Message: "failed to create the TUN device",
			Cause:   platerrors.ToPlatformError(err),
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
	t.tun = tun
	vpn.GoRelayTraffic(t.rd, t.tun, &t.wg)
	vpn.GoRelayTraffic(t.tun, t.rd, &t.wg)

	return &ConnectOutlineTunnelResult{Tunnel: t}
}

type remoteDeviceTunnel struct {
	client    *outline.Client
	tun       *os.File
	rd        *vpn.RemoteDevice
	connected bool
	wg        sync.WaitGroup
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
	// TODO(junyi): seems no need to wait
	// t.wg.Wait()
	if t.client != nil {
		if err := t.client.EndSession(); err != nil {
			slog.Error("failed to end backend Client session", "err", err)
		}
		t.client = nil
	}
}

func (t *remoteDeviceTunnel) Write(data []byte) (int, error) {
	return 0, errors.ErrUnsupported
}

func (t *remoteDeviceTunnel) UpdateUDPSupport() bool {
	t.rd.NotifyNetworkChanged()
	return false /* dummy value, should not be used */
}

// makeTunFile returns an os.File object from a TUN file descriptor `fd`.
// The returned os.File holds a separate reference to the underlying file,
// so the file will not be closed until both `fd` and the os.File are
// separately closed.  (UNIX only.)
func makeTunFile(fd int) (*os.File, error) {
	if fd < 0 {
		return nil, errors.New("Must provide a valid TUN file descriptor")
	}
	// Make a copy of `fd` so that os.File's finalizer doesn't close `fd`.
	newfd, err := unix.Dup(fd)
	if err != nil {
		return nil, err
	}
	file := os.NewFile(uintptr(newfd), "")
	if file == nil {
		return nil, errors.New("Failed to open TUN file descriptor")
	}
	return file, nil
}
