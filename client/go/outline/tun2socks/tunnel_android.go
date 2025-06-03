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
	"errors"
	"os"
	"runtime/debug"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/eycorsican/go-tun2socks/common/log"
	_ "github.com/eycorsican/go-tun2socks/common/log/simple" // Import simple log for the side effect of making logs printable.
	"golang.org/x/sys/unix"
)

// vpnMtu defines the buffer size for the packet relay.
const vpnMtu = 1500

func init() {
	// Conserve memory by increasing garbage collection frequency.
	debug.SetGCPercent(10)
	log.SetLevel(log.WARN)
}

// ConnectOutlineTunnel reads packets from a TUN device and routes it to an Outline proxy server.
// Returns an OutlineTunnel instance and does *not* take ownership of the TUN file descriptor; the
// caller is responsible for closing after OutlineTunnel disconnects.
//
//   - `fd` is the TUN device.  The OutlineTunnel acquires an additional reference to it, which
//     is released by OutlineTunnel.Disconnect(), so the caller must close `fd` _and_ call
//     Disconnect() in order to close the TUN device.
//   - `client` is the Outline client (created by [outline.NewClient]).
//   - `isUDPEnabled` indicates whether the tunnel and/or network enable UDP proxying.
//
// Returns an error if the TUN file descriptor cannot be opened, or if the tunnel fails to
// connect.
func ConnectOutlineTunnel(fd int, client *outline.Client, isUDPEnabled bool) *ConnectOutlineTunnelResult {
	tun, err := makeTunFile(fd)
	if err != nil {
		return &ConnectOutlineTunnelResult{Error: &platerrors.PlatformError{
			Code:    platerrors.SetupSystemVPNFailed,
			Message: "failed to create the TUN device",
			Cause:   platerrors.ToPlatformError(err),
		}}
	}

	t, err := newTunnel(client, isUDPEnabled, tun)
	if err != nil {
		return &ConnectOutlineTunnelResult{Error: &platerrors.PlatformError{
			Code:    platerrors.SetupTrafficHandlerFailed,
			Message: "failed to connect Outline to the TUN device",
			Cause:   platerrors.ToPlatformError(err),
		}}
	}

	go processInputPackets(t, tun)
	return &ConnectOutlineTunnelResult{Tunnel: t}
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

// processInputPackets reads packets from a TUN device `tun` and writes them to `tunnel`.
func processInputPackets(tunnel Tunnel, tun *os.File) {
	buffer := make([]byte, vpnMtu)
	for tunnel.IsConnected() {
		len, err := tun.Read(buffer)
		if err != nil {
			log.Warnf("Failed to read packet from TUN: %v", err)
			continue
		}
		if len == 0 {
			log.Infof("Read EOF from TUN")
			continue
		}
		tunnel.Write(buffer)
	}
}
