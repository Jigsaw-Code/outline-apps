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
	"encoding/json"
	"log/slog"
	"sync"

	perrs "github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
)

type configJSON struct {
	ID              string   `json:"id"`
	InterfaceName   string   `json:"interfaceName"`
	IPAddress       string   `json:"ipAddress"`
	DNSServers      []string `json:"dnsServers"`
	ConnectionName  string   `json:"connectionName"`
	RoutingTableId  uint32   `json:"routingTableId"`
	RoutingPriority uint32   `json:"routingPriority"`
	ProtectionMark  uint32   `json:"protectionMark"`
	TransportConfig string   `json:"transport"`
}

type connectionJSON struct {
	ID       string `json:"id"`
	Status   string `json:"status"`
	RouteUDP *bool  `json:"supportsUDP"`
}

type Status string

const (
	Unknown       Status = "Unknown"
	Connected     Status = "Connected"
	Disconnected  Status = "Disconnected"
	Connecting    Status = "Connecting"
	Disconnecting Status = "Disconnecting"
)

type VPNConnection interface {
	ID() string
	Status() Status
	SupportsUDP() *bool

	Establish() error
	Close() error
}

var mu sync.Mutex
var conn VPNConnection

func EstablishVPN(configStr string) (_ string, err error) {
	var conf configJSON
	if err = json.Unmarshal([]byte(configStr), &conf); err != nil {
		return "", perrs.PlatformError{
			Code:    perrs.IllegalConfig,
			Message: "invalid VPN config format",
			Cause:   perrs.ToPlatformError(err),
		}
	}

	var c VPNConnection
	if c, err = newVPNConnection(&conf); err != nil {
		return
	}
	if err = atomicReplaceVPNConn(c); err != nil {
		c.Close()
		return
	}
	slog.Debug(vpnLogPfx+"Establishing VPN connection ...", "id", c.ID())
	if err = c.Establish(); err != nil {
		// No need to call c.Close() cuz it's tracked in the global conn already
		return
	}
	slog.Info(vpnLogPfx+"VPN connection established", "id", c.ID())

	connJson, err := json.Marshal(connectionJSON{c.ID(), string(c.Status()), c.SupportsUDP()})
	if err != nil {
		return "", perrs.PlatformError{
			Code:    perrs.InternalError,
			Message: "failed to return VPN connection as JSON",
			Cause:   perrs.ToPlatformError(err),
		}
	}
	return string(connJson), nil
}

func CloseVPN() error {
	mu.Lock()
	defer mu.Unlock()
	return closeVPNNoLock()
}

func atomicReplaceVPNConn(newConn VPNConnection) error {
	mu.Lock()
	defer mu.Unlock()
	slog.Debug(vpnLogPfx+"Creating VPN Connection ...", "id", newConn.ID())
	if err := closeVPNNoLock(); err != nil {
		return err
	}
	conn = newConn
	slog.Info(vpnLogPfx+"VPN Connection created", "id", newConn.ID())
	return nil
}

func closeVPNNoLock() (err error) {
	if conn == nil {
		return nil
	}
	slog.Debug(vpnLogPfx+"Closing existing VPN Connection ...", "id", conn.ID())
	if err = conn.Close(); err == nil {
		slog.Info(vpnLogPfx+"VPN Connection closed", "id", conn.ID())
		conn = nil
	}
	return
}
