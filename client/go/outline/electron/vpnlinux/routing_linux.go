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
	"errors"
	"log/slog"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/vishvananda/netlink"
)

func ConfigureRoutingTable(tun *TUNDevice, tableId int) *platerrors.PlatformError {
	// Make sure delete previous routing entries
	DeleteRoutingTable(tableId)

	// ip route add default via "<10.0.85.5>" dev "outline-tun0" table "13579"
	r := &netlink.Route{
		LinkIndex: tun.link.Attrs().Index,
		Table:     tableId,
		Gw:        tun.ip.IP,
		//Dst:       tun.ip.IPNet,
		//Src:       tun.ip.IP,
		Scope: netlink.SCOPE_LINK,
	}
	if err := netlink.RouteAdd(r); err != nil {
		slog.Error("failed to add routing entry", "table", tableId, "route", r, "err", err)
		return &platerrors.PlatformError{
			Code:    platerrors.SetupSystemVPNFailed,
			Message: "failed to add routing entries to routing table",
			Details: platerrors.ErrorDetails{"table": tableId},
			Cause:   platerrors.ToPlatformError(err),
		}
	}
	slog.Info("successfully added routing entry", "table", tableId, "route", r)

	return nil
}

func DeleteRoutingTable(tableId int) *platerrors.PlatformError {
	filter := &netlink.Route{Table: tableId}
	routes, err := netlink.RouteListFiltered(netlink.FAMILY_ALL, filter, netlink.RT_FILTER_TABLE)
	if err != nil {
		slog.Warn("failed to list routing entries", "table", tableId)
		return &platerrors.PlatformError{
			Code:    platerrors.DisconnectSystemVPNFailed,
			Message: "failed to list routing entries in routing table",
			Details: platerrors.ErrorDetails{"table": tableId},
			Cause:   platerrors.ToPlatformError(err),
		}
	}

	nDel := 0
	var errs error
	for _, r := range routes {
		if err := netlink.RouteDel(&r); err == nil {
			slog.Debug("successfully deleted routing entry", "table", tableId, "route", r)
			nDel++
		} else {
			slog.Warn("failed to delete routing entry", "table", tableId, "route", r)
			errs = errors.Join(errs, err)
		}
	}
	if errs != nil {
		slog.Warn("not able to delete all routing entries", "table", tableId, "err", errs)
		return &platerrors.PlatformError{
			Code:    platerrors.DisconnectSystemVPNFailed,
			Message: "not able to delete all routing entries in routing table",
			Details: platerrors.ErrorDetails{"table": tableId},
			Cause:   platerrors.ToPlatformError(errs),
		}
	}

	slog.Info("successfully deleted all routing entries", "table", tableId, "n", nDel)
	return nil
}
