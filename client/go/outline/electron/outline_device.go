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

	"github.com/Jigsaw-Code/outline-apps/client/go/outline"
	perrs "github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-sdk/network"
	"github.com/Jigsaw-Code/outline-sdk/network/dnstruncate"
	"github.com/Jigsaw-Code/outline-sdk/network/lwip2transport"
)

type outlineDevice struct {
	network.IPDevice

	c   *outline.Client
	pkt network.DelegatePacketProxy

	remote, fallback network.PacketProxy
}

func (d *outlineDevice) Connect() (perr *perrs.PlatformError) {
	var err error

	d.remote, err = network.NewPacketProxyFromPacketListener(d.c.PacketListener)
	if err != nil {
		return errSetupHandler("failed to create datagram handler", err)
	}
	slog.Debug("[OutlineNetDev] remote UDP handler created")

	if d.fallback, err = dnstruncate.NewPacketProxy(); err != nil {
		return errSetupHandler("failed to create datagram handler for DNS fallback", err)
	}
	slog.Debug("[OutlineNetDev] local DNS-fallback UDP handler created")

	if perr = d.RefreshConnectivity(); perr != nil {
		return
	}

	d.IPDevice, err = lwip2transport.ConfigureDevice(d.c.StreamDialer, d.pkt)
	if err != nil {
		return errSetupHandler("failed to configure Outline network stack", err)
	}
	slog.Debug("[OutlineNetDev] lwIP network stack configured")

	slog.Info("successfully connected Outline network device")
	return nil
}

func (d *outlineDevice) Close() (err error) {
	if d.IPDevice != nil {
		if err = d.IPDevice.Close(); err == nil {
			d.IPDevice = nil
		}
	}
	slog.Info("successfully closed Outline network device")
	return
}

func (d *outlineDevice) RefreshConnectivity() (perr *perrs.PlatformError) {
	var err error
	proxy := d.remote
	if d.pkt == nil {
		if d.pkt, err = network.NewDelegatePacketProxy(proxy); err != nil {
			return errSetupHandler("failed to create combined datagram handler", err)
		}
	} else {
		if err = d.pkt.SetProxy(proxy); err != nil {
			return errSetupHandler("failed to update combined datagram handler", err)
		}
	}
	slog.Debug("[OutlineNetDev] UDP handler refreshed")
	return nil
}

func errSetupHandler(msg string, cause error) *perrs.PlatformError {
	slog.Error("[OutlineNetDev] "+msg, "err", cause)
	return &perrs.PlatformError{
		Code:    perrs.SetupTrafficHandlerFailed,
		Message: msg,
		Cause:   perrs.ToPlatformError(cause),
	}
}
