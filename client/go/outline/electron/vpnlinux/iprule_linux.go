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
	"log/slog"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/vishvananda/netlink"
)

func AddIPRules(tableId int, fwMark uint32) (*netlink.Rule, *platerrors.PlatformError) {
	rule := netlink.NewRule()
	rule.Priority = 23456
	rule.Family = netlink.FAMILY_ALL
	rule.Table = tableId
	rule.Mark = fwMark
	rule.Invert = true

	if err := netlink.RuleAdd(rule); err != nil {
		slog.Error("failed to add IP rule", "rule", rule, "err", err)
		return nil, &platerrors.PlatformError{
			Code:    platerrors.SetupSystemVPNFailed,
			Message: "failed to add ip rule to Outline routing table",
			Cause:   platerrors.ToPlatformError(err),
		}
	}

	slog.Info("successfully added IP rule", "rule", rule)
	return rule, nil
}

func DeleteIPRules(rule *netlink.Rule) *platerrors.PlatformError {
	if rule == nil {
		return nil
	}

	if err := netlink.RuleDel(rule); err != nil {
		slog.Error("failed to remove IP rule", "rule", rule, "err", err)
		return &platerrors.PlatformError{
			Code:    platerrors.DisconnectSystemVPNFailed,
			Message: "failed to remove the ip rule to Outline routing table",
			Cause:   platerrors.ToPlatformError(err),
		}
	}

	slog.Info("successfully removed IP rule", "rule", rule)
	return nil
}
