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

package main

import (
	"context"
	"io"
	"log/slog"
	"net"
	"sync"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/electron/vpnlinux"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Wifx/gonetworkmanager/v2"
	"github.com/vishvananda/netlink"
)

type VPNConnection struct {
	Status   string `json:"status"`
	RouteUDP bool   `json:"routeUDP"`

	ctx context.Context `json:"-"`
	wg  sync.WaitGroup  `json:"-"`

	outline *outlineDevice `json:"-"`

	tun    *vpnlinux.TUNDevice         `json:"-"`
	nmConn gonetworkmanager.Connection `json:"-"`
	table  int                         `json:"-"`
	rule   *netlink.Rule               `json:"-"`
}

func establishVPN(ctx context.Context, conf *VPNConfig) (_ *VPNConnection, perr *platerrors.PlatformError) {
	slog.Debug("establishing VPN connection ...", "config", conf)
	conn := &VPNConnection{ctx: ctx}
	defer func() {
		if perr != nil {
			closeVPNConn(conn)
		}
	}()

	// Create Outline socket and protect it
	if conn.outline, perr = configureOutlineDevice(conf.TransportConfig, int(conf.ProtectionMark)); perr != nil {
		return
	}

	if conn.tun, perr = vpnlinux.ConfigureTUNDevice(conf.InterfaceName, conf.IPAddress); perr != nil {
		return nil, perr
	}
	if conn.nmConn, perr = vpnlinux.ConfigureNMConnection(conn.tun, net.ParseIP(conf.DNSServers[0])); perr != nil {
		return
	}
	if perr = vpnlinux.ConfigureRoutingTable(conn.tun, conf.RoutingTableId); perr != nil {
		return
	}
	conn.table = conf.RoutingTableId
	if conn.rule, perr = vpnlinux.AddIPRules(conf.RoutingTableId, conf.ProtectionMark); perr != nil {
		return
	}

	go func() {
		slog.Debug("Copying traffic from TUN Device -> OutlineDevice...")
		n, err := io.Copy(conn.outline, conn.tun.File)
		slog.Debug("TUN Device -> OutlineDevice done", "n", n, "err", err)
	}()
	go func() {
		slog.Debug("Copying traffic from OutlineDevice -> TUN Device...")
		n, err := io.Copy(conn.tun.File, conn.outline)
		slog.Debug("OutlineDevice -> TUN Device done", "n", n, "err", err)
	}()

	slog.Info("VPN connection established", "conn", conn)
	return conn, nil
}

func closeVPNConn(conn *VPNConnection) (perr *platerrors.PlatformError) {
	if conn == nil {
		return nil
	}

	if conn.rule != nil {
		if perr = vpnlinux.DeleteIPRules(conn.rule); perr != nil {
			return
		}
	}
	if conn.nmConn != nil {
		if perr = vpnlinux.DeleteNMConnection(conn.nmConn); perr != nil {
			return
		}
	}

	// All following errors are harmless and can be ignored.
	if conn.table > 0 {
		vpnlinux.DeleteRoutingTable(conn.table)
	}
	if conn.outline != nil {
		conn.outline.Close()
	}
	vpnlinux.CloseTUNDevice(conn.tun)

	slog.Info("VPN connection closed")
	return nil
}
