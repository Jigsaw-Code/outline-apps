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
	"fmt"
	"io"
	"log/slog"
	"net"
	"sync/atomic"
	"time"

	"github.com/eycorsican/go-tun2socks/core"
	"github.com/eycorsican/go-tun2socks/proxy/dnsfallback"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/connectivity"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
)

// Tunnel represents a tunnel from a TUN device to a server.
type Tunnel interface {
	// IsConnected is true if Disconnect has not been called.
	IsConnected() bool
	// Disconnect closes the underlying resources. Subsequent Write calls will fail.
	Disconnect()
	// Write writes input data to the TUN interface.
	Write(data []byte) (int, error)

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

type outlinetunnel struct {
	tunWriter   io.WriteCloser
	lwipStack   core.LWIPStack
	isConnected bool
	udpHandler  *toggleUDPConnHandler
	client      *outline.Client
}

var _ Tunnel = (*outlinetunnel)(nil)

// newTunnel connects a tunnel to the given client and returns an `outline.Tunnel`.
//
// `client` is the StreamDialer to proxy TCP traffic and the PacketListener to proxy UDP traffic.
// `isUDPEnabled` indicates if the Outline proxy and the network support proxying UDP traffic.
// `tunWriter` is used to output packets back to the TUN device.  OutlineTunnel.Disconnect() will close `tunWriter`.
func newTunnel(client *outline.Client, isUDPEnabled bool, tunWriter io.WriteCloser) (tunnel Tunnel, err error) {
	if tunWriter == nil {
		return nil, errors.New("must provide a TUN writer")
	}
	if err := client.StartSession(); err != nil {
		return nil, fmt.Errorf("failed to start backend Client session: %w", err)
	}
	defer func() {
		if err != nil {
			client.EndSession()
		}
	}()
	core.RegisterOutputFn(func(data []byte) (int, error) {
		return tunWriter.Write(data)
	})
	lwipStack := core.NewLWIPStack()
	udpHandler := &toggleUDPConnHandler{
		Handler:         NewUDPHandler(client, 30*time.Second),
		FallbackHandler: dnsfallback.NewUDPHandler(),
	}
	udpHandler.UseFallback.Store(!isUDPEnabled)
	t := &outlinetunnel{tunWriter, lwipStack, true, udpHandler, client}
	core.RegisterTCPConnHandler(NewTCPHandler(client))
	core.RegisterUDPConnHandler(udpHandler)
	return t, nil
}

func (t *outlinetunnel) IsConnected() bool {
	return t.isConnected
}

func (t *outlinetunnel) Disconnect() {
	if !t.isConnected {
		return
	}
	t.isConnected = false
	t.lwipStack.Close()
	t.tunWriter.Close()
	if t.client != nil {
		if err := t.client.EndSession(); err != nil {
			slog.Error("failed to end backend Client session", "err", err)
		}
		t.client = nil
	}
}

func (t *outlinetunnel) Write(data []byte) (int, error) {
	if !t.isConnected {
		return 0, errors.New("failed to write, network stack closed")
	}
	return t.lwipStack.Write(data)
}

func (t *outlinetunnel) UpdateUDPSupport() bool {
	resolverAddr := &net.UDPAddr{IP: net.ParseIP("1.1.1.1"), Port: 53}
	isUDPEnabled := connectivity.CheckUDPConnectivityWithDNS(t.client, resolverAddr) == nil
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
