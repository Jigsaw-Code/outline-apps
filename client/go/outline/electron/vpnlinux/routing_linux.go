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

	perrs "github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/vishvananda/netlink"
)

type RoutingRule struct {
	table int
	rule  *netlink.Rule
}

func NewRoutingRule(tun *TUNDevice, table, priority int, fwmark uint32) (_ *RoutingRule, perr *perrs.PlatformError) {
	r := &RoutingRule{table: table}
	defer func() {
		if perr != nil {
			r.Close()
		}
	}()

	// Make sure delete previous routing entries
	r.Close()

	// ip route add default via "<10.0.85.5>" dev "outline-tun0" table "113"
	rt := &netlink.Route{
		LinkIndex: tun.link.Attrs().Index,
		Table:     r.table,
		Gw:        tun.ip.IP,
		Scope:     netlink.SCOPE_LINK,
	}
	if err := netlink.RouteAdd(rt); err != nil {
		return nil, errSetupVPN(nlLogPfx, "failed to add routing entry", err, "table", r.table, "route", rt)
	}
	slog.Info(nlLogPfx+"routing entry added", "table", r.table, "route", rt)

	// ip rule add not fwmark "0x711E" table "113" priority "456"
	r.rule = netlink.NewRule()
	r.rule.Priority = priority
	r.rule.Family = netlink.FAMILY_ALL
	r.rule.Table = r.table
	r.rule.Mark = fwmark
	r.rule.Invert = true
	if err := netlink.RuleAdd(r.rule); err != nil {
		return nil, errSetupVPN(nlLogPfx, "failed to add IP rule", err, "rule", r.rule)
	}
	slog.Info(nlLogPfx+"IP rule added", "rule", r.rule)

	return r, nil
}

func (r *RoutingRule) Close() *perrs.PlatformError {
	if r == nil {
		return nil
	}

	if r.rule != nil {
		if err := netlink.RuleDel(r.rule); err != nil {
			return errCloseVPN(nlLogPfx, "failed to delete IP rule", err, "rule", r.rule)
		}
		slog.Info(nlLogPfx+"deleted IP rule", "rule", r.rule)
		r.rule = nil
	}

	if r.table > 0 {
		filter := &netlink.Route{Table: r.table}
		rts, err := netlink.RouteListFiltered(netlink.FAMILY_ALL, filter, netlink.RT_FILTER_TABLE)
		if err != nil {
			return errCloseVPN(nlLogPfx, "failed to list routing entries", err, "table", r.table)
		}

		nDel := 0
		var errs error
		for _, rt := range rts {
			if err := netlink.RouteDel(&rt); err == nil {
				slog.Debug(nlLogPfx+"successfully deleted routing entry", "table", r.table, "route", rt)
				nDel++
			} else {
				slog.Warn(nlLogPfx+"failed to delete routing entry", "table", r.table, "route", rt, "err", err)
				errs = errors.Join(errs, err)
			}
		}
		if errs != nil {
			return errCloseVPN(nlLogPfx, "failed to delete all routig entries", errs, "table", r.table)
		}
		if nDel > 0 {
			slog.Info(nlLogPfx+"deleted all routing entries", "table", r.table, "n", nDel)
		}
	}

	return nil
}
