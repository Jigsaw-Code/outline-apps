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
	"log/slog"

	"github.com/songgao/water"
)

func (c *linuxVPNConn) establishTUNDevice() error {
	tun, err := water.New(water.Config{
		DeviceType: water.TUN,
		PlatformSpecificParams: water.PlatformSpecificParams{
			Name:    c.nmOpts.TUNName,
			Persist: false,
		},
	})
	if err != nil {
		return errSetupVPN(ioLogPfx, "failed to create TUN device", err, "name", c.nmOpts.TUNName)
	}
	c.tun = tun
	slog.Info(vpnLogPfx+"TUN device created", "name", tun.Name())
	return nil
}

func (c *linuxVPNConn) closeTUNDevice() error {
	if c == nil || c.tun == nil {
		return nil
	}
	if err := c.tun.Close(); err != nil {
		return errCloseVPN(vpnLogPfx, "failed to close TUN device", err, "name", c.nmOpts.TUNName)
	}
	slog.Info(vpnLogPfx+"closed TUN device", "name", c.nmOpts.TUNName)
	return nil
}
