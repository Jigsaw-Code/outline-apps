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
	"log/slog"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/electron/vpnlinux"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
)

func establishVPN(ctx context.Context, config *VPNConfig) (_ *VPNConnection, perr *platerrors.PlatformError) {
	slog.Debug("establishing VPN connection ...", "config", config)
	conn := &VPNConnection{}

	// Create Outline socket and protect it
	if conn.outline, perr = configureOutlineDevice(config.TransportConfig); perr != nil {
		return
	}
	defer func() {
		if perr != nil {
			conn.outline.Close()
		}
	}()

	// Create and configure the TUN device
	if conn.tun, perr = vpnlinux.ConfigureTUNDevice(config.InterfaceName); perr != nil {
		return nil, perr
	}
	defer func() {
		if perr != nil {
			vpnlinux.CloseTUNDevice(conn.tun)
		}
	}()

	// Create and configure Network Manager connection
	if perr = vpnlinux.ConfigureNMConnection(); perr != nil {
		return
	}

	// Create and configure Outline routing table
	if perr = vpnlinux.ConfigureRoutingTable(config.InterfaceName, config.RoutingTableId); perr != nil {
		return
	}

	// Add IP rule to route all traffic to Outline routing table
	if conn.ipRule, perr = vpnlinux.AddIPRule(config.RoutingTableId, 13579); perr != nil {
		return
	}
	defer func() {
		if perr != nil {
			vpnlinux.DelIPRule(conn.ipRule)
		}
	}()

	slog.Info("VPN connection established", "conn", conn)
	return conn, nil
}

func closeVPNConn(conn *VPNConnection) (perr *platerrors.PlatformError) {
	if perr = vpnlinux.DelIPRule(conn.ipRule); perr != nil {
		return
	}

	// All following errors can be ignored
	conn.outline.Close()
	vpnlinux.CloseTUNDevice(conn.tun)
	return nil
}
