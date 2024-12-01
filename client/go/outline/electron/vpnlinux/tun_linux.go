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
	"log/slog"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/songgao/water"
	"github.com/vishvananda/netlink"
)

type TUNDevice struct {
	File *water.Interface

	name string
	ip   *netlink.Addr
	link netlink.Link
}

func ConfigureTUNDevice(name, ip string) (_ *TUNDevice, perr *platerrors.PlatformError) {
	// Make sure the previous TUN device is deleted
	CloseTUNDevice(&TUNDevice{name: name})

	var err error
	tun := &TUNDevice{}
	defer func() {
		if perr != nil {
			CloseTUNDevice(tun)
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
		slog.Error("failed to create TUN device", "name", name, "err", err)
		return nil, &platerrors.PlatformError{
			Code:    platerrors.SetupSystemVPNFailed,
			Message: "failed to create the TUN device",
			Details: platerrors.ErrorDetails{"name": name},
			Cause:   platerrors.ToPlatformError(err),
		}
	}
	tun.name = tun.File.Name()
	slog.Info("successfully created TUN device", "name", tun.name)

	if tun.link, err = netlink.LinkByName(tun.name); err != nil {
		slog.Error("failed to find the newly created TUN device", "name", tun.name, "err", err)
		return nil, &platerrors.PlatformError{
			Code:    platerrors.SetupSystemVPNFailed,
			Message: "failed to find the created TUN device",
			Details: platerrors.ErrorDetails{"name": tun.name},
			Cause:   platerrors.ToPlatformError(err),
		}
	}

	ipCidr := ip + "/32"
	addr, err := netlink.ParseAddr(ipCidr)
	if err != nil {
		return nil, &platerrors.PlatformError{
			Code:    platerrors.IllegalConfig,
			Message: "VPN local IP address is not valid",
			Details: platerrors.ErrorDetails{"ip": ipCidr},
			Cause:   platerrors.ToPlatformError(err),
		}
	}
	if err = netlink.AddrReplace(tun.link, addr); err != nil {
		slog.Error("failed to assign IP to the TUN device", "name", tun.name, "ip", ipCidr, "err", err)
		return nil, &platerrors.PlatformError{
			Code:    platerrors.SetupSystemVPNFailed,
			Message: "failed to assign IP to the TUN device",
			Details: platerrors.ErrorDetails{"name": tun.name, "ip": ipCidr},
			Cause:   platerrors.ToPlatformError(err),
		}
	}
	tun.ip = addr
	slog.Info("successfully assigned IP address to the TUN device", "name", tun.name, "ip", tun.ip)

	if err = netlink.LinkSetUp(tun.link); err != nil {
		slog.Error("failed to bring up the TUN device", "name", tun.name, "err", err)
		return nil, &platerrors.PlatformError{
			Code:    platerrors.SetupSystemVPNFailed,
			Message: "failed to bring up the TUN device",
			Details: platerrors.ErrorDetails{"name": tun.name},
			Cause:   platerrors.ToPlatformError(err),
		}
	}
	slog.Info("successfully brought up the TUN device", "name", tun.name)

	return tun, nil
}

func CloseTUNDevice(tun *TUNDevice) *platerrors.PlatformError {
	if tun == nil {
		return nil
	}
	if tun.name != "" && tun.link == nil {
		tun.link, _ = netlink.LinkByName(tun.name)
	}
	if tun.File != nil {
		if err := tun.File.Close(); err != nil {
			slog.Error("failed to close TUN file", "name", tun.name, "err", err)
			return &platerrors.PlatformError{
				Code:    platerrors.DisconnectSystemVPNFailed,
				Message: "failed to close the TUN device",
				Details: platerrors.ErrorDetails{"name": tun.name},
				Cause:   platerrors.ToPlatformError(err),
			}
		}
		slog.Info("successfully closed TUN file", "name", tun.name)
	}
	if tun.link != nil {
		if err := netlink.LinkDel(tun.link); err != nil {
			slog.Warn("delete TUN device", "name", tun.name, "err", err)
			return &platerrors.PlatformError{
				Code:    platerrors.DisconnectSystemVPNFailed,
				Message: "failed to delete the TUN device",
				Details: platerrors.ErrorDetails{"name": tun.name},
				Cause:   platerrors.ToPlatformError(err),
			}
		}
		slog.Info("successfully deleted TUN device", "name", tun.name)
	}

	return nil
}
