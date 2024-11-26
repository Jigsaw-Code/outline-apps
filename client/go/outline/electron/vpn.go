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
	"encoding/json"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/songgao/water"
	"github.com/vishvananda/netlink"
)

type VPNConfig struct {
	InterfaceName   string   `json:"interfaceName"`
	IPAddress       string   `json:"ipAddress"`
	DNSServers      []string `json:"dnsServers"`
	RoutingTableId  int      `json:"routingTableId"`
	TransportConfig string   `json:"transport"`
}

type VPNConnection struct {
	Status   string `json:"status"`
	RouteUDP bool   `json:"routeUDP"`

	tun     *water.Interface `json:"-"`
	outline *outlineDevice   `json:"-"`
	ipRule  *netlink.Rule    `json:"-"`
}

var conn *VPNConnection

func EstablishVPN(configStr string) (_ string, perr *platerrors.PlatformError) {
	var config VPNConfig
	err := json.Unmarshal([]byte(configStr), &config)
	if err != nil {
		return "", &platerrors.PlatformError{
			Code:    platerrors.IllegalConfig,
			Message: "illegal VPN config format",
			Cause:   platerrors.ToPlatformError(err),
		}
	}

	if conn, perr = establishVPN(context.TODO(), &config); perr != nil {
		return
	}

	if conn == nil {
		return "", &platerrors.PlatformError{
			Code:    platerrors.InternalError,
			Message: "unexpected nil VPN connection",
		}
	}
	connJson, err := json.Marshal(conn)
	if err != nil {
		return "", &platerrors.PlatformError{
			Code:    platerrors.InternalError,
			Message: "failed to marshal VPN connection",
			Cause:   platerrors.ToPlatformError(err),
		}
	}
	return string(connJson), nil
}

func CloseVPN() *platerrors.PlatformError {
	if conn == nil {
		return nil
	}
	return closeVPNConn(conn)
}
