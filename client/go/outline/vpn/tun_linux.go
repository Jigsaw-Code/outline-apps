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
	"time"

	gonm "github.com/Wifx/gonetworkmanager/v2"
	"github.com/songgao/water"
)

// newTUNDevice creates a non-persist layer 3 TUN device with the given name.
func newTUNDevice(name string) (io.ReadWriteCloser, error) {
	tun, err := water.New(water.Config{
		DeviceType: water.TUN,
		PlatformSpecificParams: water.PlatformSpecificParams{
			Name:    name,
			Persist: false,
		},
	})
	if err != nil {
		return nil, err
	}
	if tun.Name() != name {
		return nil, fmt.Errorf("TUN device name mismatch: requested `%s`, created `%s`", name, tun.Name())
	}
	return tun, nil
}

// waitForTUNDeviceToBeAvailable waits for the TUN device with the given name to be available
// in the specific NetworkManager.
func waitForTUNDeviceToBeAvailable(nm gonm.NetworkManager, name string) (dev gonm.Device, err error) {
	for retries := 20; retries > 0; retries-- {
		slog.Debug(nmLogPfx+"trying to find TUN device ...", "tun", name)
		dev, err = nm.GetDeviceByIpIface(name)
		if dev != nil && err == nil {
			return
		}
		slog.Debug(nmLogPfx+"waiting for TUN device to be available", "err", err)
		time.Sleep(50 * time.Millisecond)
	}
	return nil, errSetupVPN(nmLogPfx, "failed to find TUN device", err, "tun", name)
}
