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
	lwipStack    core.LWIPStack
	streamDialer transport.StreamDialer
	packetDialer transport.PacketListener
	isUDPEnabled bool // Whether the tunnel supports proxying UDP.
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
	t := &outlinetunnel{base, lwipStack, streamDialer, packetListener, isUDPEnabled}
	t.registerConnectionHandlers()
	return t, nil
}

func (t *outlinetunnel) UpdateUDPSupport() bool {
	resolverAddr := &net.UDPAddr{IP: net.ParseIP("1.1.1.1"), Port: 53}
	isUDPEnabled := connectivity.CheckUDPConnectivityWithDNS(t.packetDialer, resolverAddr) == nil
	if t.isUDPEnabled != isUDPEnabled {
		t.isUDPEnabled = isUDPEnabled
		t.lwipStack.Close() // Close existing connections to avoid using the previous handlers.
		t.registerConnectionHandlers()
	}
	return isUDPEnabled
}

// Registers UDP and TCP connection handlers to the tunnel's host and port.
// Registers a DNS/TCP fallback UDP handler when UDP is disabled.
func (t *outlinetunnel) registerConnectionHandlers() {
	var udpHandler core.UDPConnHandler
	if t.isUDPEnabled {
		udpHandler = NewUDPHandler(t.packetDialer, 30*time.Second)
	} else {
		udpHandler = dnsfallback.NewUDPHandler()
	}
	core.RegisterTCPConnHandler(NewTCPHandler(t.streamDialer))
	core.RegisterUDPConnHandler(udpHandler)
}
