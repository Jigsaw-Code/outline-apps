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

// configJSON represents the JSON structure for setting up a VPN connection.
// This is typically passed from TypeScript.
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

// connectionJSON defines the JSON structure of a [VPNConnection].
// This is typically returned to TypeScript.
type connectionJSON struct {
	ID       string `json:"id"`
	Status   string `json:"status"`
	RouteUDP *bool  `json:"supportsUDP"`
}

// Status defines the possible states of a VPN connection.
type Status string

// Constants representing the different VPN connection statuses.
const (
	StatusUnknown       Status = "Unknown"
	StatusConnected     Status = "Connected"
	StatusDisconnected  Status = "Disconnected"
	StatusConnecting    Status = "Connecting"
	StatusDisconnecting Status = "Disconnecting"
)

// VPNConnection is a platform neutral interface of a VPN connection.
type VPNConnection interface {
	// ID returns the unique identifier of this VPNConnection.
	// Typically it is passed in from the TypeScript through configJson.
	ID() string

	// Status returns the current Status of the VPNConnection.
	Status() Status

	// SupportsUDP indicates whether the remote proxy can handle UDP traffic.
	// nil means unknown.
	SupportsUDP() *bool

	// Establish tries to connect this VPNConnection.
	Establish() error

	// Close tries to disconnect this VPNConnection.
	Close() error
}

// The global singleton VPN connection.
// This package allows at most one active VPN connection at the same time.
var mu sync.Mutex
var conn VPNConnection

// EstablishVPN establishes a new active [VPNConnection] with the given configuration.
// It will first close any active [VPNConnection] using [CloseVPN], and then mark the
// newly created [VPNConnection] as the currently active connection.
// It returns the connectionJSON as a string, or an error if the connection fails.
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

// CloseVPN closes the currently active [VPNConnection].
func CloseVPN() error {
	mu.Lock()
	defer mu.Unlock()
	return closeVPNNoLock()
}

// atomicReplaceVPNConn atomically replaces the global conn with newConn.
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

// closeVPNNoLock closes the current VPN connection stored in conn without acquiring
// the mutex. It is assumed that the caller holds the mutex.
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
