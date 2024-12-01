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

const nmLogPrefix = "[NetworkManager] "

func ConfigureNMConnection(tun *TUNDevice, dns net.IP) (gonm.Connection, *perrs.PlatformError) {
	nm, err := gonm.NewNetworkManager()
	if err != nil {
		return nil, nmErr("failed to connect", err)
	}
	slog.Debug(nmLogPrefix + "connected")

	dev, err := nm.GetDeviceByIpIface(tun.name)
	if err != nil {
		return nil, nmErr("failed to find TUN device", err, "tun", tun.name)
	}
	slog.Debug(nmLogPrefix+"found TUN device", "tun", tun.name, "dev", dev.GetPath())

	aconn, perr := waitForActiveConnection(dev)
	if perr != nil {
		return nil, perr
	}

	conn, err := aconn.GetPropertyConnection()
	if err != nil {
		return nil, nmErr("failed to get the underlying connection", err, "conn", aconn.GetPath())
	}
	slog.Debug(nmLogPrefix+"got the underlying connection", "conn", aconn.GetPath(), "setting", conn.GetPath())

	props, err := conn.GetSettings()
	if err != nil {
		return nil, nmErr("failed to read setting values", err, "setting", conn.GetPath())
	}
	slog.Debug(nmLogPrefix+"got all setting values", "setting", conn.GetPath())

	purgeLegacyIPv6Props(props)
	configureDNSProps(props, dns)

	if err := conn.Update(props); err != nil {
		return nil, nmErr("failed to update connection setting", err, "setting", conn.GetPath())
	}

	slog.Info(nmLogPrefix+"successfully configured NetworkManager connection", "conn", conn.GetPath())
	return conn, nil
}

func DeleteNMConnection(conn gonm.Connection) *perrs.PlatformError {
	err := conn.Delete()
	if err != nil {
		return nmErr("failed to delete connection setting", err, "setting", conn.GetPath())
	}
	return nil
}

var waitIntervals = []time.Duration{
	20 * time.Millisecond, 50 * time.Millisecond, 100 * time.Millisecond, 150 * time.Millisecond,
	200 * time.Millisecond, 500 * time.Millisecond, 1 * time.Second, 2 * time.Second, 4 * time.Second}

// waitForActiveConnection waits for an gonm.ActiveConnection to be ready.
func waitForActiveConnection(dev gonm.Device) (gonm.ActiveConnection, *perrs.PlatformError) {
	for _, interval := range waitIntervals {
		slog.Debug(nmLogPrefix + "waiting for active connection ...")
		time.Sleep(interval)
		conn, err := dev.GetPropertyActiveConnection()
		if err == nil && conn != nil {
			slog.Debug(nmLogPrefix+"active connection identified", "dev", dev.GetPath(), "conn", conn.GetPath())
			return conn, nil
		}
	}
	return nil, nmErr("TUN device connection was not ready in time", nil, "dev", dev.GetPath())
}

func purgeLegacyIPv6Props(props gonm.ConnectionSettings) {
	if ipv6Props, ok := props["ipv6"]; ok {
		delete(ipv6Props, "addresses")
		delete(ipv6Props, "routes")
	}
}

func configureDNSProps(props gonm.ConnectionSettings, dns4 net.IP) {
	dnsIPv4 := binary.NativeEndian.Uint32(dns4.To4())
	props["ipv4"]["dns"] = []uint32{dnsIPv4}
}

func nmErr(msg string, cause error, params ...any) *perrs.PlatformError {
	logParams := append(params, "err", cause)
	slog.Error(nmLogPrefix+msg, logParams...)

	details := perrs.ErrorDetails{}
	for i := 1; i < len(params); i += 2 {
		if key, ok := params[i-1].(string); ok {
			details[key] = params[i]
		}
	}
	return &perrs.PlatformError{
		Code:    perrs.SetupSystemVPNFailed,
		Message: "NetworkManager: " + msg,
		Details: details,
		Cause:   perrs.ToPlatformError(cause),
	}
}
