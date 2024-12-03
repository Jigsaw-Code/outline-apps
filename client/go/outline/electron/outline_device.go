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

package main

import (
	"log/slog"
	"syscall"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-sdk/network"
	"github.com/Jigsaw-Code/outline-sdk/network/dnstruncate"
	"github.com/Jigsaw-Code/outline-sdk/network/lwip2transport"
)

type outlineDevice struct {
	network.IPDevice
	network.DelegatePacketProxy

	remote, fallback network.PacketProxy
}

func configureOutlineDevice(transportConfig string, sockmark int) (*outlineDevice, *platerrors.PlatformError) {
	var err error
	dev := &outlineDevice{}

	controlFWMark := func(network, address string, c syscall.RawConn) error {
		return c.Control(func(fd uintptr) {
			syscall.SetsockoptInt(int(fd), syscall.SOL_SOCKET, syscall.SO_MARK, sockmark)
		})
	}
	tcpDialer := outline.DefaultBaseTCPDialer()
	udpDialer := outline.DefaultBaseUDPDialer()
	tcpDialer.Control = controlFWMark
	udpDialer.Control = controlFWMark

	c, err := outline.NewClientWithBaseDialers(transportConfig, tcpDialer, udpDialer)
	if err != nil {
		return nil, platerrors.ToPlatformError(err)
	}

	dev.remote, err = network.NewPacketProxyFromPacketListener(c.PacketListener)
	if err != nil {
		return nil, &platerrors.PlatformError{
			Code:    platerrors.SetupTrafficHandlerFailed,
			Message: "failed to create datagram handler",
			Cause:   platerrors.ToPlatformError(err),
		}
	}

	if dev.fallback, err = dnstruncate.NewPacketProxy(); err != nil {
		return nil, &platerrors.PlatformError{
			Code:    platerrors.SetupTrafficHandlerFailed,
			Message: "failed to create datagram handler for DNS fallback",
			Cause:   platerrors.ToPlatformError(err),
		}
	}

	if dev.DelegatePacketProxy, err = network.NewDelegatePacketProxy(dev.remote); err != nil {
		return nil, &platerrors.PlatformError{
			Code:    platerrors.SetupTrafficHandlerFailed,
			Message: "failed to combine datagram handlers",
			Cause:   platerrors.ToPlatformError(err),
		}
	}

	dev.IPDevice, err = lwip2transport.ConfigureDevice(c.StreamDialer, dev)
	if err != nil {
		return nil, &platerrors.PlatformError{
			Code:    platerrors.SetupTrafficHandlerFailed,
			Message: "failed to configure network stack",
			Cause:   platerrors.ToPlatformError(err),
		}
	}

	slog.Info("successfully configured outline device")
	return dev, nil
}
