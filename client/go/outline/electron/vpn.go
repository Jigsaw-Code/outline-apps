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
	"encoding/json"
	"log/slog"
	"sync"

	perrs "github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
)

type vpnConfigJSON struct {
	ID              string   `json:"id"`
	InterfaceName   string   `json:"interfaceName"`
	IPAddress       string   `json:"ipAddress"`
	DNSServers      []string `json:"dnsServers"`
	RoutingTableId  int      `json:"routingTableId"`
	RoutingPriority int      `json:"routingPriority"`
	ProtectionMark  uint32   `json:"protectionMark"`
	TransportConfig string   `json:"transport"`
}

type vpnConnectionJSON struct {
	ID       string `json:"id"`
	Status   string `json:"status"`
	RouteUDP *bool  `json:"routeUDP"`
}

type VPNStatus string

const (
	VPNConnected     VPNStatus = "Connected"
	VPNDisconnected  VPNStatus = "Disconnected"
	VPNConnecting    VPNStatus = "Connecting"
	VPNDisconnecting VPNStatus = "Disconnecting"
)

type VPNConnection interface {
	ID() string
	Status() VPNStatus
	RouteUDP() *bool

	Establish() *perrs.PlatformError
	Close() *perrs.PlatformError
}

var mu sync.Mutex
var conn VPNConnection

func EstablishVPN(configStr string) (_ string, perr *perrs.PlatformError) {
	var conf vpnConfigJSON
	err := json.Unmarshal([]byte(configStr), &conf)
	if err != nil {
		return "", &perrs.PlatformError{
			Code:    perrs.IllegalConfig,
			Message: "invalid VPN config format",
			Cause:   perrs.ToPlatformError(err),
		}
	}

	var c VPNConnection
	if c, perr = newVPNConnection(&conf); perr != nil {
		return
	}
	if perr = atomicReplaceVPNConn(c); perr != nil {
		c.Close()
		return
	}
	slog.Debug("[VPN] Establishing VPN connection ...", "id", c.ID())
	if perr = c.Establish(); perr != nil {
		// No need to call c.Close() cuz it's tracked in the global conn already
		return
	}
	slog.Info("[VPN] VPN connection established", "id", c.ID())

	connJson, err := json.Marshal(vpnConnectionJSON{c.ID(), string(c.Status()), c.RouteUDP()})
	if err != nil {
		return "", &perrs.PlatformError{
			Code:    perrs.InternalError,
			Message: "failed to return VPN connection as JSON",
			Cause:   perrs.ToPlatformError(err),
		}
	}
	return string(connJson), nil
}

func CloseVPN() *perrs.PlatformError {
	mu.Lock()
	defer mu.Unlock()
	return closeVPNNoLock()
}

func atomicReplaceVPNConn(newConn VPNConnection) *perrs.PlatformError {
	mu.Lock()
	defer mu.Unlock()
	slog.Debug("[VPN] Creating VPN Connection ...", "id", newConn.ID())
	if err := closeVPNNoLock(); err != nil {
		return err
	}
	conn = newConn
	slog.Info("[VPN] VPN Connection created", "id", newConn.ID())
	return nil
}

func closeVPNNoLock() (perr *perrs.PlatformError) {
	if conn == nil {
		return nil
	}
	slog.Debug("[VPN] Closing existing VPN Connection ...", "id", conn.ID())
	if perr = conn.Close(); perr == nil {
		slog.Info("[VPN] VPN Connection closed", "id", conn.ID())
		conn = nil
	}
	return
}
