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

package vpnlinux

import (
	"errors"
	"log/slog"
	"net"
	"syscall"

	perrs "github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/songgao/water"
	"github.com/vishvananda/netlink"
)

type TUNDevice struct {
	File *water.Interface

	name string
	ip   *netlink.Addr
	link netlink.Link
}

func NewTUNDevice(name string, ipCidr *net.IPNet) (_ *TUNDevice, perr *perrs.PlatformError) {
	var err error
	tun := &TUNDevice{name: name}

	// Make sure the previous TUN device is deleted
	tun.Close()

	// Make sure we don't leak any resources if anything goes wrong
	defer func() {
		if perr != nil {
			tun.Close()
		}
	}()

	tun.File, err = water.New(water.Config{
		DeviceType: water.TUN,
		PlatformSpecificParams: water.PlatformSpecificParams{
			Name:    name,
			Persist: false,
		},
	})
	if err != nil {
		return nil, errSetupVPN(ioLogPfx, "failed to create TUN file", err, "name", name)
	}
	tun.name = tun.File.Name()
	slog.Debug(ioLogPfx+"TUN file created", "name", tun.name)

	if tun.link, err = netlink.LinkByName(tun.name); err != nil {
		return nil, errSetupVPN(nlLogPfx, "failed to find the new TUN device", err, "name", tun.name)
	}
	slog.Debug(nlLogPfx+"TUN device found", "name", tun.name)

	tun.ip = &netlink.Addr{IPNet: ipCidr}
	if err = netlink.AddrReplace(tun.link, &netlink.Addr{IPNet: ipCidr}); err != nil {
		return nil, errSetupVPN(nlLogPfx, "failed to assign IP to TUN device",
			err, "name", tun.name, "ip", ipCidr.String())
	}
	slog.Debug(nlLogPfx+"assigned IP to TUN device", "name", tun.name, "ip", tun.ip)

	if err = netlink.LinkSetUp(tun.link); err != nil {
		return nil, errSetupVPN(nlLogPfx, "failed to bring up TUN device", err, "name", tun.name)
	}
	slog.Debug(nlLogPfx+"brought up TUN device", "name", tun.name)

	slog.Info("successfully configured Outline TUN device", "name", tun.name)
	return tun, nil
}

func (tun *TUNDevice) Close() *perrs.PlatformError {
	if tun == nil {
		return nil
	}
	if tun.name != "" && tun.link == nil {
		tun.link, _ = netlink.LinkByName(tun.name)
	}

	if tun.File != nil {
		if err := tun.File.Close(); err != nil {
			return errCloseVPN(ioLogPfx, "failed to close TUN file", err, "name", tun.name)
		}
		slog.Debug(ioLogPfx+"closed TUN file", "name", tun.name)
		tun.File = nil
	}

	if tun.link != nil {
		// Typically the previous Close call should delete the TUN device
		if err := netlink.LinkDel(tun.link); err != nil && errors.Is(err, syscall.ENODEV) {
			return errCloseVPN(nlLogPfx, "failed to delete TUN device", err, "name", tun.name)
		}
		slog.Debug(nlLogPfx+"deleted TUN device", "name", tun.name)
		tun.link = nil
	}

	slog.Info("cleaned up Outline TUN device", "name", tun.name)
	tun.name = ""
	return nil
}
