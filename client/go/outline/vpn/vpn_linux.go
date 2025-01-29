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
	"context"
	"io"
	"log/slog"
	"net"

	perrs "github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	gonm "github.com/Wifx/gonetworkmanager/v2"
)

// linuxVPNConn implements a platformVPNConn on the Linux platform.
type linuxVPNConn struct {
	tun    io.ReadWriteCloser
	nmOpts *nmConnectionOptions
	nm     gonm.NetworkManager
	ac     gonm.ActiveConnection
}

var _ platformVPNConn = (*linuxVPNConn)(nil)

// newPlatformVPNConn creates a new Linux-specific platformVPNConn.
// You need to call Establish() in order to make it connected.
func newPlatformVPNConn(conf *Config) (_ platformVPNConn, err error) {
	c := &linuxVPNConn{
		nmOpts: &nmConnectionOptions{
			Name:            conf.ConnectionName,
			TUNName:         conf.InterfaceName,
			TUNAddr4:        net.ParseIP(conf.IPAddress).To4(),
			DNSServers4:     make([]net.IP, 0, 2),
			FWMark:          conf.ProtectionMark,
			RoutingTable:    conf.RoutingTableId,
			RoutingPriority: conf.RoutingPriority,
		},
	}

	if c.nmOpts.Name == "" {
		return nil, errInvalidConfig("must provide a valid connection name")
	}
	if c.nmOpts.TUNName == "" {
		return nil, errInvalidConfig("must provide a valid TUN interface name")
	}
	if c.nmOpts.TUNAddr4 == nil {
		return nil, errInvalidConfig("must provide a valid TUN interface IP(v4)")
	}
	for _, dns := range conf.DNSServers {
		dnsIP := net.ParseIP(dns).To4()
		if dnsIP == nil {
			return nil, errInvalidConfig("DNS server must be a valid IP(v4)", "dns", dns)
		}
		c.nmOpts.DNSServers4 = append(c.nmOpts.DNSServers4, dnsIP)
	}

	if c.nm, err = gonm.NewNetworkManager(); err != nil {
		return nil, errSetupVPN("failed to connect NetworkManager DBus", err)
	}
	slog.Debug("NetworkManager DBus connected")

	return c, nil
}

// TUN returns the Linux L3 TUN device.
func (c *linuxVPNConn) TUN() io.ReadWriteCloser { return c.tun }

// Establish tries to create the TUN device and route all traffic to it.
func (c *linuxVPNConn) Establish(ctx context.Context) (err error) {
	if ctx.Err() != nil {
		return perrs.PlatformError{Code: perrs.OperationCanceled}
	}

	if c.tun, err = newTUNDevice(c.nmOpts.TUNName); err != nil {
		return errSetupVPN("failed to create tun device", err, "name", c.nmOpts.Name)
	}
	slog.Info("tun device created", "name", c.nmOpts.TUNName)

	if c.ac, err = establishNMConnection(c.nm, c.nmOpts); err != nil {
		return
	}
	slog.Info("successfully configured NetworkManager connection", "conn", c.ac.GetPath())
	return nil
}

// Close tries to restore the routing and deletes the TUN device.
func (c *linuxVPNConn) Close() (err error) {
	if c == nil {
		return nil
	}

	closeNMConnection(c.nm, c.ac)
	if c.tun != nil {
		// this is the only error that matters
		if err = c.tun.Close(); err != nil {
			err = errCloseVPN("failed to delete tun device", err, "name", c.nmOpts.TUNName)
		} else {
			slog.Info("tun device deleted", "name", c.nmOpts.TUNName)
		}
	}

	return
}
