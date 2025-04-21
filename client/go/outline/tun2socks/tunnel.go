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
	"io"
	"net"
	"sync/atomic"
	"time"

	"github.com/eycorsican/go-tun2socks/core"
	"github.com/eycorsican/go-tun2socks/proxy/dnsfallback"

	"github.com/Jigsaw-Code/outline-sdk/transport"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/connectivity"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-apps/client/go/tunnel"
)

// Tunnel represents a tunnel from a TUN device to a server.
type Tunnel interface {
	tunnel.Tunnel

	// UpdateUDPSupport determines if UDP is supported following a network connectivity change.
	// Sets the tunnel's UDP connection handler accordingly, falling back to DNS over TCP if UDP is not supported.
	// Returns whether UDP proxying is supported in the new network.
	UpdateUDPSupport() bool
}

// ConnectOutlineTunnelResult represents the result of [ConnectOutlineTunnel].
//
// We use a struct instead of a tuple to preserve a strongly typed error that gobind recognizes.
type ConnectOutlineTunnelResult struct {
	Tunnel Tunnel
	Error  *platerrors.PlatformError
}

// Deprecated: use Tunnel directly.
type OutlineTunnel = Tunnel

type outlinetunnel struct {
	tunnel.Tunnel
	packetDialer transport.PacketListener
	udpHandler   *toggleUDPConnHandler
}

// newTunnel connects a tunnel to the given stream and packet dialers and returns an `outline.Tunnel`.
//
// `streamDialer` is the StreamDialer to proxy TCP traffic.
// `packetListener` is the PacketListener tp proxy UDP traffic.
// `isUDPEnabled` indicates if the Outline proxy and the network support proxying UDP traffic.
// `tunWriter` is used to output packets back to the TUN device.  OutlineTunnel.Disconnect() will close `tunWriter`.
func newTunnel(streamDialer transport.StreamDialer, packetListener transport.PacketListener, isUDPEnabled bool, tunWriter io.WriteCloser) (Tunnel, error) {
	if tunWriter == nil {
		return nil, errors.New("must provide a TUN writer")
	}
	core.RegisterOutputFn(func(data []byte) (int, error) {
		return tunWriter.Write(data)
	})
	lwipStack := core.NewLWIPStack()
	base := tunnel.NewTunnel(tunWriter, lwipStack)
	udpHandler := &toggleUDPConnHandler{
		Handler:         NewUDPHandler(packetListener, 30*time.Second),
		FallbackHandler: dnsfallback.NewUDPHandler(),
	}
	udpHandler.UseFallback.Store(!isUDPEnabled)
	t := &outlinetunnel{base, packetListener, udpHandler}
	core.RegisterTCPConnHandler(NewTCPHandler(streamDialer))
	core.RegisterUDPConnHandler(udpHandler)
	return t, nil
}

func (t *outlinetunnel) UpdateUDPSupport() bool {
	resolverAddr := &net.UDPAddr{IP: net.ParseIP("1.1.1.1"), Port: 53}
	isUDPEnabled := connectivity.CheckUDPConnectivityWithDNS(t.packetDialer, resolverAddr) == nil
	t.udpHandler.UseFallback.Store(!isUDPEnabled)
	return isUDPEnabled
}

type toggleUDPConnHandler struct {
	UseFallback     atomic.Bool
	Handler         core.UDPConnHandler
	FallbackHandler core.UDPConnHandler
}

// Connect implements core.UDPConnHandler.
func (r *toggleUDPConnHandler) Connect(conn core.UDPConn, target *net.UDPAddr) error {
	if r.UseFallback.Load() {
		return r.FallbackHandler.Connect(conn, target)
	} else {
		return r.Handler.Connect(conn, target)
	}
}

// ReceiveTo implements core.UDPConnHandler.
func (r *toggleUDPConnHandler) ReceiveTo(conn core.UDPConn, data []byte, addr *net.UDPAddr) error {
	if r.UseFallback.Load() {
		return r.FallbackHandler.ReceiveTo(conn, data, addr)
	} else {
		return r.Handler.ReceiveTo(conn, data, addr)
	}
}

var _ core.UDPConnHandler = &toggleUDPConnHandler{}
