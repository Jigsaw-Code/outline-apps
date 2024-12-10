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

package outline

import (
	"log/slog"

	perrs "github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-sdk/network"
	"github.com/Jigsaw-Code/outline-sdk/network/dnstruncate"
	"github.com/Jigsaw-Code/outline-sdk/network/lwip2transport"
)

type Device struct {
	network.IPDevice

	c           *Client
	pkt         network.DelegatePacketProxy
	supportsUDP *bool

	remote, fallback network.PacketProxy
}

type LinuxOptions struct {
	FWMark uint32
}

type DeviceOptions struct {
	LinuxOpts *LinuxOptions
}

func NewDevice(c *Client) *Device {
	return &Device{
		c: c,
	}
}

func (d *Device) Connect() (err error) {
	d.remote, err = network.NewPacketProxyFromPacketListener(d.c.PacketListener)
	if err != nil {
		return errSetupHandler("failed to create datagram handler", err)
	}
	slog.Debug("[Outline] remote UDP handler created")

	if d.fallback, err = dnstruncate.NewPacketProxy(); err != nil {
		return errSetupHandler("failed to create datagram handler for DNS fallback", err)
	}
	slog.Debug("[Outline] local DNS-fallback UDP handler created")

	if err = d.RefreshConnectivity(); err != nil {
		return
	}

	d.IPDevice, err = lwip2transport.ConfigureDevice(d.c.StreamDialer, d.pkt)
	if err != nil {
		return errSetupHandler("failed to configure Outline network stack", err)
	}
	slog.Debug("[Outline] lwIP network stack configured")

	slog.Info("[Outline] successfully connected to Outline server")
	return nil
}

func (d *Device) Close() (err error) {
	if d.IPDevice != nil {
		err = d.IPDevice.Close()
	}
	slog.Info("[Outline] successfully disconnected from Outline server")
	return
}

func (d *Device) RefreshConnectivity() (err error) {
	slog.Debug("[Outine] Testing connectivity of Outline server ...")
	result := CheckTCPAndUDPConnectivity(d.c)
	if result.TCPError != nil {
		slog.Warn("[Outline] Outline server connectivity test failed", "err", result.TCPError)
		return result.TCPError
	}

	var proxy network.PacketProxy
	canHandleUDP := false
	if result.UDPError != nil {
		slog.Warn("[Outline] server cannot handle UDP traffic", "err", result.UDPError)
		proxy = d.fallback
	} else {
		slog.Debug("[Outline] server can handle UDP traffic")
		proxy = d.remote
		canHandleUDP = true
	}

	if d.pkt == nil {
		if d.pkt, err = network.NewDelegatePacketProxy(proxy); err != nil {
			return errSetupHandler("failed to create combined datagram handler", err)
		}
	} else {
		if err = d.pkt.SetProxy(proxy); err != nil {
			return errSetupHandler("failed to update combined datagram handler", err)
		}
	}
	d.supportsUDP = &canHandleUDP
	slog.Info("[Outline] Outline server connectivity test done", "supportsUDP", canHandleUDP)
	return nil
}

func (d *Device) SupportsUDP() *bool {
	return d.supportsUDP
}

func errSetupHandler(msg string, cause error) error {
	slog.Error("[Outline] "+msg, "err", cause)
	return perrs.PlatformError{
		Code:    perrs.SetupTrafficHandlerFailed,
		Message: msg,
		Cause:   perrs.ToPlatformError(cause),
	}
}
