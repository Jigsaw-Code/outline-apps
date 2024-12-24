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
	"io"
	"runtime/debug"
	"time"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

// TunWriter is an interface that allows for outputting packets to the TUN (VPN).
type TunWriter interface {
	io.WriteCloser
}

func init() {
	// Apple VPN extensions have a memory limit of 15MB. Conserve memory by increasing garbage
	// collection frequency and returning memory to the OS every minute.
	debug.SetGCPercent(10)
	// TODO: Check if this is still needed in go 1.13, which returns memory to the OS
	// automatically.
	ticker := time.NewTicker(time.Minute * 1)
	go func() {
		for range ticker.C {
			debug.FreeOSMemory()
		}
	}()
}

// ConnectOutlineTunnel reads packets from a TUN device and routes it to an Outline proxy server.
// Returns an OutlineTunnel instance that should be used to input packets to the tunnel.
//
// `tunWriter` is used to output packets to the TUN (VPN).
// `client` is the Outline client (created by [outline.NewTransport]).
// `isUDPEnabled` indicates whether the tunnel and/or network enable UDP proxying.
//
// Sets an error if the tunnel fails to connect.
func ConnectOutlineTunnel(tunWriter TunWriter, client *outline.Transport, isUDPEnabled bool) *ConnectOutlineTunnelResult {
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

	t, err := newTunnel(transport.FuncStreamDialer(client.Dial), client, isUDPEnabled, tunWriter)
	if err != nil {
		return &ConnectOutlineTunnelResult{Error: &platerrors.PlatformError{
			Code:    platerrors.SetupTrafficHandlerFailed,
			Message: "failed to connect Outline to the TUN device",
			Cause:   platerrors.ToPlatformError(err),
		}}
	}
	return &ConnectOutlineTunnelResult{Tunnel: t}
}
