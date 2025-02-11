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

package vpn

import (
	"fmt"
	"io"
	"log/slog"

	gonm "github.com/Wifx/gonetworkmanager/v2"
	"github.com/songgao/water"
)

type tunDevice struct {
	*water.Interface
	nm    gonm.NetworkManager
	nmDev gonm.Device
}

// newTUNDevice creates a non-persist layer 3 TUN device with the given name.
func newTUNDevice(nm gonm.NetworkManager, name string) (_ io.ReadWriteCloser, err error) {
	tun := &tunDevice{nm: nm}

	// Create TUN device file
	tun.Interface, err = water.New(water.Config{
		DeviceType: water.TUN,
		PlatformSpecificParams: water.PlatformSpecificParams{
			Name:    name,
			Persist: false,
		},
	})
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			tun.Interface.Close()
		}
	}()

	if tun.Name() != name {
		return nil, fmt.Errorf("TUN device name mismatch: requested `%s`, created `%s`", name, tun.Name())
	}

	// Wait for the TUN device to be available in NetworkManager
	if tun.nmDev, err = waitForTUNDeviceToBeAvailable(nm, tun.Name()); err != nil {
		return nil, err
	}
	slog.Debug("found TUN device in NetworkManager", "dev", tun.nmDev.GetPath())

	// Let NetworkManager take care of the TUN device
	if err = setTUNDeviceManaged(tun.nmDev, true); err != nil {
		return nil, err
	}
	slog.Debug("TUN device is now managed by NetworkManager", "dev", tun.nmDev.GetPath())

	slog.Info("TUN device successfully created", "name", tun.Name(), "dev", tun.nmDev.GetPath())
	return tun, nil
}

func (tun *tunDevice) Close() (err error) {
	tun.Interface.Close()
	if err = deleteTUNDevice(tun.nm, tun.Name()); err == nil {
		slog.Info("TUN device deleted", "name", tun.Name())
	}
	return
}

func setTUNDeviceManaged(dev gonm.Device, value bool) error {
	if err := dev.SetPropertyManaged(value); err != nil {
		return fmt.Errorf("NetworkManager failed to set TUN device Managed=%v: %w", value, err)
	}
	// wait it to take effect
	return nmCallWithRetry(func() error {
		slog.Debug("waiting for TUN to be Managed", "dev", dev.GetPath(), "managed", value)
		managed, err := dev.GetPropertyManaged()
		if err == nil && managed != value {
			err = fmt.Errorf("failed to confirm TUN device Managed=%v", value)
		}
		return err
	})
}

// deleteTUNDevice deletes all TUN devices of a given name and confirms all of them are deleted.
func deleteTUNDevice(nm gonm.NetworkManager, name string) error {
	return nmCallWithRetry(func() error {
		dev, err := nm.GetDeviceByIpIface(name)
		if dev == nil {
			slog.Debug("TUN device already deleted", "name", name, "msg", err)
			return nil
		}
		slog.Debug("deleting TUN device ...", "dev", dev.GetPath(), "name", name)
		if err := dev.Delete(); err != nil {
			slog.Debug("failed to delete TUN device, will retry later", "dev", dev.GetPath(), "err", err)
			return err
		}

		// confirm deletion
		if dev, err = nm.GetDeviceByIpIface(name); dev != nil {
			return fmt.Errorf("TUN device `%s` still exists, will retry later", name)
		}
		slog.Debug("TUN device deleted", "name", name, "msg", err)
		return nil
	})
}

func waitForTUNDeviceToBeAvailable(nm gonm.NetworkManager, name string) (dev gonm.Device, err error) {
	err = nmCallWithRetry(func() error {
		slog.Debug("trying to locate TUN device in NetworkManager...", "tun", name)
		dev, err = nm.GetDeviceByIpIface(name)
		return err
	})
	return
}
