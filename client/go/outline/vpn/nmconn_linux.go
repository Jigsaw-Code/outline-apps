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
	"encoding/binary"
	"log/slog"
	"net"
	"time"

	gonm "github.com/Wifx/gonetworkmanager/v2"
	"golang.org/x/sys/unix"
)

type nmConnectionOptions struct {
	Name            string
	TUNName         string
	TUNAddr4        net.IP
	DNSServers4     []net.IP
	FWMark          uint32
	RoutingTable    uint32
	RoutingPriority uint32
}

func establishNMConnection(nm gonm.NetworkManager, opts *nmConnectionOptions) (ac gonm.ActiveConnection, err error) {
	if nm == nil {
		panic("a NetworkManager must be provided")
	}
	defer func() {
		if err != nil {
			closeNMConnection(nm, ac)
			ac = nil
		}
	}()

	dev, err := waitForTUNDeviceToBeAvailable(nm, opts.TUNName)
	if err != nil {
		return nil, errSetupVPN("failed to find tun device", err, "tun", opts.TUNName, "api", "NetworkManager")
	}
	slog.Debug("located tun device in NetworkManager", "tun", opts.TUNName, "dev", dev.GetPath())

	if err = dev.SetPropertyManaged(true); err != nil {
		return nil, errSetupVPN("failed to manage tun device", err, "dev", dev.GetPath(), "api", "NetworkManager")
	}
	slog.Debug("NetworkManager now manages the tun device", "dev", dev.GetPath())

	props := make(map[string]map[string]interface{})
	configureCommonProps(props, opts)
	configureTUNProps(props)
	configureIPv4Props(props, opts)
	slog.Debug("populated NetworkManager connection settings", "settings", props)

	// The previous SetPropertyManaged call needs some time to take effect (typically within 50ms)
	for retries := 20; retries > 0; retries-- {
		slog.Debug("trying to create NetworkManager connection for tun device...", "dev", dev.GetPath())
		ac, err = nm.AddAndActivateConnection(props, dev)
		if err == nil {
			break
		}
		slog.Debug("failed to create NetworkManager connection, will retry later", "err", err)
		time.Sleep(50 * time.Millisecond)
	}
	if err != nil {
		return ac, errSetupVPN("failed to create connection", err, "dev", dev.GetPath(), "api", "NetworkManager")
	}
	return
}

func closeNMConnection(nm gonm.NetworkManager, ac gonm.ActiveConnection) error {
	if nm == nil {
		panic("a NetworkManager must be provided")
	}
	if ac == nil {
		return nil
	}

	if err := nm.DeactivateConnection(ac); err != nil {
		slog.Warn("failed to deactivate NetworkManager connection", "err", err, "conn", ac.GetPath())
	}
	slog.Debug("deactivated NetworkManager connection", "conn", ac.GetPath())

	conn, err := ac.GetPropertyConnection()
	if err == nil {
		err = conn.Delete()
	}
	if err != nil {
		return errCloseVPN("failed to delete NetworkManager connection", err, "conn", ac.GetPath())
	}
	slog.Info("NetworkManager connection deleted", "conn", ac.GetPath())

	return nil
}

// NetworkManager settings reference:
//   https://networkmanager.pages.freedesktop.org/NetworkManager/NetworkManager/nm-settings-dbus.html

func configureCommonProps(props map[string]map[string]interface{}, opts *nmConnectionOptions) {
	props["connection"] = map[string]interface{}{
		"id":             opts.Name,
		"interface-name": opts.TUNName,
	}
}

func configureTUNProps(props map[string]map[string]interface{}) {
	props["tun"] = map[string]interface{}{
		// The operating mode of the virtual device.
		// Allowed values are 1 (tun) to create a layer 3 device and 2 (tap) to create an Ethernet-like layer 2 one.
		"mode": uint32(1),
	}
}

func configureIPv4Props(props map[string]map[string]interface{}, opts *nmConnectionOptions) {
	dnsList := make([]uint32, 0, len(opts.DNSServers4))
	for _, dns := range opts.DNSServers4 {
		// net.IP is already BigEndian, if we use BigEndian.Uint32, it will be reversed back to LittleEndian.
		dnsList = append(dnsList, binary.NativeEndian.Uint32(dns))
	}

	props["ipv4"] = map[string]interface{}{
		"method": "manual",

		// Array of IPv4 addresses. Each address dictionary contains at least 'address' and 'prefix' entries,
		// containing the IP address as a string, and the prefix length as a uint32.
		"address-data": []map[string]interface{}{{
			"address": opts.TUNAddr4.String(),
			"prefix":  uint32(32),
		}},

		// Array of IP addresses of DNS servers (as network-byte-order integers)
		"dns": dnsList,

		// A lower value has a higher priority.
		// Negative values will exclude other configurations with a greater value.
		// The default value is 50 for VPN connections (and 100 for regular connections).
		"dns-priority": -99,

		// routing domain to exclude all other DNS resolvers
		// https://manpages.ubuntu.com/manpages/jammy/man5/resolved.conf.5.html
		"dns-search": []string{"~."},

		// NetworkManager will add these routing entries:
		//   - default via 10.0.85.5 dev outline-tun0 table 13579 proto static metric 450
		//   - 10.0.85.5 dev outline-tun0 table 13579 proto static scope link metric 450
		"route-data": []map[string]interface{}{{
			"dest":     "0.0.0.0",
			"prefix":   uint32(0),
			"next-hop": opts.TUNAddr4.String(),
			"table":    opts.RoutingTable,
		}},

		// Array of dictionaries for routing rules. Each routing rule supports the following options:
		// action (y), dport-end (q), dport-start (q), family (i), from (s), from-len (y), fwmark (u), fwmask (u),
		// iifname (s), invert (b), ipproto (s), oifname (s), priority (u), sport-end (q), sport-start (q),
		// supress-prefixlength (i), table (u), to (s), tos (y), to-len (y), range-end (u), range-start (u).
		//
		//   - not fwmark "0x711E" table "113" priority "456"
		"routing-rules": []map[string]interface{}{{
			"family":   unix.AF_INET,
			"priority": opts.RoutingPriority,
			"fwmark":   opts.FWMark,
			"fwmask":   uint32(0xFFFFFFFF),
			"invert":   true,
			"table":    opts.RoutingTable,
		}},
	}
}
