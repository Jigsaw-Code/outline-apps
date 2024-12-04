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
	"encoding/binary"
	"log/slog"
	"net"
	"time"

	perrs "github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	gonm "github.com/Wifx/gonetworkmanager/v2"
)

type NMConnection struct {
	nm gonm.NetworkManager
	ac gonm.ActiveConnection
	c  gonm.Connection
}

func NewNMConnection(tun *TUNDevice, dns net.IP) (_ *NMConnection, perr *perrs.PlatformError) {
	c := &NMConnection{}
	defer func() {
		if perr != nil {
			c.Close()
		}
	}()

	var err error
	if c.nm, err = gonm.NewNetworkManager(); err != nil {
		return nil, errSetupVPN(nmLogPfx, "failed to connect", err)
	}
	slog.Debug(nmLogPfx + "connected")

	dev, err := c.nm.GetDeviceByIpIface(tun.name)
	if err != nil {
		return nil, errSetupVPN(nmLogPfx, "failed to find TUN device", err, "tun", tun.name)
	}
	slog.Debug(nmLogPfx+"located TUN device", "tun", tun.name, "dev", dev.GetPath())

	if c.ac, perr = waitForActiveConnection(dev); perr != nil {
		return nil, perr
	}

	if c.c, err = c.ac.GetPropertyConnection(); err != nil {
		return nil, errSetupVPN(nmLogPfx, "failed to get the underlying connection", err, "conn", c.ac.GetPath())
	}
	slog.Debug(nmLogPfx+"found the underlying connection", "conn", c.ac.GetPath(), "setting", c.c.GetPath())

	props, err := c.c.GetSettings()
	if err != nil {
		return nil, errSetupVPN(nmLogPfx, "failed to read setting values", err, "setting", c.c.GetPath())
	}
	slog.Debug(nmLogPfx+"retrieved all setting values", "setting", c.c.GetPath())

	purgeLegacyIPv6Props(props)
	configureDNSProps(props, dns)

	if err := c.c.Update(props); err != nil {
		return nil, errSetupVPN(nmLogPfx, "failed to update connection setting", err, "setting", c.c.GetPath())
	}
	slog.Debug(nmLogPfx+"saved all new setting values", "setting", c.c.GetPath())

	slog.Info(nmLogPfx+"successfully configured NetworkManager connection", "conn", c.ac.GetPath())
	return c, nil
}

func (c *NMConnection) Close() *perrs.PlatformError {
	if c == nil || c.nm == nil {
		return nil
	}

	if c.ac != nil {
		if err := c.nm.DeactivateConnection(c.ac); err != nil {
			slog.Warn(nmLogPfx+"not able to deactivate connection", "err", err, "conn", c.ac.GetPath())
		}
		slog.Debug(nmLogPfx+"deactivated connection", "conn", c.ac.GetPath())
	}
	if c.c != nil {
		if err := c.c.Delete(); err != nil {
			return errCloseVPN(nmLogPfx, "failed to delete connection setting", err, "setting", c.c.GetPath())
		}
		slog.Debug(nmLogPfx+"connection setting deleted", "setting", c.c.GetPath())
	}

	slog.Info(nmLogPfx+"cleaned up NetworkManager connection", "conn", c.ac.GetPath(), "setting", c.c.GetPath())
	return nil
}

var waitIntervals = []time.Duration{
	20 * time.Millisecond, 50 * time.Millisecond, 100 * time.Millisecond, 150 * time.Millisecond,
	200 * time.Millisecond, 500 * time.Millisecond, 1 * time.Second, 2 * time.Second, 4 * time.Second}

// waitForActiveConnection waits for an gonm.ActiveConnection to be ready.
func waitForActiveConnection(dev gonm.Device) (gonm.ActiveConnection, *perrs.PlatformError) {
	for _, interval := range waitIntervals {
		slog.Debug(nmLogPfx + "waiting for active connection ...")
		time.Sleep(interval)
		conn, err := dev.GetPropertyActiveConnection()
		if err == nil && conn != nil {
			slog.Debug(nmLogPfx+"active connection identified", "dev", dev.GetPath(), "conn", conn.GetPath())
			return conn, nil
		}
	}
	return nil, errSetupVPN(nmLogPfx, "TUN device connection was not ready in time", nil, "dev", dev.GetPath())
}

func purgeLegacyIPv6Props(props gonm.ConnectionSettings) {
	// These props are legacy IPv6 settings that won't be accepted by the NetworkManager D-Bus API
	if ipv6Props, ok := props["ipv6"]; ok {
		delete(ipv6Props, "addresses")
		delete(ipv6Props, "routes")
	}
}

func configureDNSProps(props gonm.ConnectionSettings, dns4 net.IP) {
	// net.IP is already BigEndian, if we use BigEndian.Uint32, it will be reversed back to LittleEndian.
	dnsIPv4 := binary.NativeEndian.Uint32(dns4.To4())
	props["ipv4"]["dns"] = []uint32{dnsIPv4}

	// A lower value has a higher priority.
	// Negative values will exclude other configurations with a greater value.
	props["ipv4"]["dns-priority"] = -99

	// routing domain to exclude all other DNS resolvers
	// https://manpages.ubuntu.com/manpages/jammy/man5/resolved.conf.5.html
	props["ipv4"]["dns-search"] = []string{"~."}
}
