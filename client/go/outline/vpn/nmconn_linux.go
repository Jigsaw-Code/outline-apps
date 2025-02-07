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
	"fmt"
	"io"
	"log/slog"
	"net"
	"slices"

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

type nmConnection struct {
	nm   gonm.NetworkManager
	name string
	ac   gonm.ActiveConnection
}

func newNMConnection(nm gonm.NetworkManager, opts *nmConnectionOptions) (_ io.Closer, err error) {
	if nm == nil {
		panic("a NetworkManager must be provided")
	}

	c := &nmConnection{
		nm:   nm,
		name: opts.Name,
	}
	defer func() {
		if err != nil {
			c.Close()
		}
	}()

	props := make(map[string]map[string]interface{})
	configureCommonProps(props, opts)
	configureTUNProps(props)
	configureIPv4Props(props, opts)
	slog.Debug("populated NetworkManager connection settings", "settings", props)

	dev, err := nm.GetDeviceByIpIface(opts.TUNName)
	if err != nil {
		return nil, fmt.Errorf("failed to locate TUN device in NetworkManager: %w", err)
	}

	err = nmCallWithRetry(func() (e error) {
		slog.Debug("trying to create NetworkManager connection for tun device...", "dev", dev.GetPath())
		if c.ac, e = nm.AddAndActivateConnection(props, dev); e == nil {
			slog.Info("successfully created NetworkManager connection", "conn", c.ac.GetPath())
		} else {
			slog.Debug("failed to create NetworkManager connection, will retry later", "err", err)
		}
		return e
	})
	return c, err
}

func (c *nmConnection) Close() error {
	if c.ac != nil {
		if err := c.nm.DeactivateConnection(c.ac); err != nil {
			slog.Warn("failed to deactivate NetworkManager connection", "err", err, "conn", c.ac.GetPath())
		}
		slog.Debug("deactivated NetworkManager connection", "conn", c.ac.GetPath())
	}
	return clearNMConnections(c.nm, c.name)
}

// clearNMConnections removes all NetworkManager connections with a given name.
func clearNMConnections(nm gonm.NetworkManager, name string) error {
	if nm == nil {
		panic("a NetworkManager must be provided")
	}
	if name == "" {
		return nil
	}

	slog.Debug("deleting all NetworkManager connections with name ...", "name", name)
	nmSettings, err := gonm.NewSettings()
	if err != nil {
		return fmt.Errorf("failed to connect to NetworkManager settings: %w", err)
	}
	return nmCallWithRetry(func() error {
		conns, err := listConnectionsByName(nmSettings, name)
		if err != nil {
			return err
		}
		for _, conn := range conns {
			slog.Debug("deleting connection", "conn", conn.GetPath())
			if err := conn.Delete(); err != nil {
				slog.Debug("failed to delete connection, will rety later", "conn", conn.GetPath())
			}
		}

		// confirm deletion
		conns, err = listConnectionsByName(nmSettings, name)
		if err != nil || len(conns) > 0 {
			return fmt.Errorf("NetworkManager connection `%s` still exists, will retry later", name)
		}
		slog.Info("all NetworkManager connections deleted", "name", name)
		return nil
	})
}

func listConnectionsByName(nmSettings gonm.Settings, name string) ([]gonm.Connection, error) {
	conns, err := nmSettings.ListConnections()
	if err != nil {
		slog.Warn("failed to list NetworkManager connections", "err", err)
		return nil, err
	}
	return slices.DeleteFunc(conns, func(conn gonm.Connection) bool {
		props, err := conn.GetSettings()
		if err != nil {
			return true
		}
		connProps, ok := props["connection"]
		if !ok {
			return true
		}
		return connProps["id"] != name
	}), nil
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
