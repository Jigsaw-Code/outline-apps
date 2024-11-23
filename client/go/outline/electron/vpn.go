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
	"io"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-sdk/network"
)

type VPNConfig struct {
	InterfaceName   string   `json:"interfaceName"`
	IPAddress       string   `json:"ipAddress"`
	DNSServers      []string `json:"dnsServers"`
	TransportConfig string   `json:"transport"`
}

type VPNConnection struct {
	Status   string `json:"status"`
	RouteUDP bool   `json:"routeUDP"`

	tun     io.ReadWriteCloser `json:"-"`
	outline network.IPDevice
}

func EstablishVPN(configStr string) (string, *platerrors.PlatformError) {
	var config VPNConfig
	err := json.Unmarshal([]byte(configStr), &config)
	if err != nil {
		return "", &platerrors.PlatformError{
			Code:    platerrors.IllegalConfig,
			Message: "illegal VPN config format",
			Cause:   platerrors.ToPlatformError(err),
		}
	}

	conn, perr := establishVPN(context.TODO(), &config)
	if perr != nil {
		return "", perr
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
