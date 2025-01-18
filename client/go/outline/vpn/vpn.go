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
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"sync"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/event"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

// Config holds the configuration to establish a system-wide [VPNConnection].
type Config struct {
	ID              string   `json:"id"`
	InterfaceName   string   `json:"interfaceName"`
	IPAddress       string   `json:"ipAddress"`
	DNSServers      []string `json:"dnsServers"`
	ConnectionName  string   `json:"connectionName"`
	RoutingTableId  uint32   `json:"routingTableId"`
	RoutingPriority uint32   `json:"routingPriority"`
	ProtectionMark  uint32   `json:"protectionMark"`
}

// platformVPNConn is an interface representing an OS-specific VPN connection.
type platformVPNConn interface {
	// Establish creates a TUN device and routes all system traffic to it.
	Establish(ctx context.Context) error

	// TUN returns a L3 IP tun device associated with the VPN connection.
	TUN() io.ReadWriteCloser

	// Close terminates the VPN connection and closes the TUN device.
	Close() error
}

// ConnectionStatus represents the status of a [VPNConnection].
type ConnectionStatus string

const (
	ConnectionConnected     ConnectionStatus = "Connected"
	ConnectionDisconnected  ConnectionStatus = "Disconnected"
	ConnectionConnecting    ConnectionStatus = "Connecting"
	ConnectionDisconnecting ConnectionStatus = "Disconnecting"
)

// ConnectionStatusChanged event will be raised when the status of a [VPNConnection] changes.
const ConnectionStatusChanged event.EventName = "VPNConnStatusChanged"

// VPNConnection represents a system-wide VPN connection.
type VPNConnection struct {
	ID     string           `json:"id"`
	Status ConnectionStatus `json:"status"`

	cancelEst     context.CancelFunc
	wgEst, wgCopy sync.WaitGroup

	proxy    *RemoteDevice
	platform platformVPNConn
}

// The global singleton VPN connection.
// This package allows at most one active VPN connection at the same time.
var mu sync.Mutex
var conn *VPNConnection

// SetStatus sets the [VPNConnection] Status and raises the [ConnectionStatusChanged] event.
func (c *VPNConnection) SetStatus(status ConnectionStatus) {
	c.Status = status
	if connJson, err := json.Marshal(c); err == nil {
		event.Fire(ConnectionStatusChanged, string(connJson))
	} else {
		slog.Warn("failed to marshal VPN connection", "err", err)
	}
}

// EstablishVPN establishes a new active [VPNConnection] connecting to a [ProxyDevice]
// with the given VPN [Config].
// It first closes any active [VPNConnection] using [CloseVPN], and then marks the
// newly created [VPNConnection] as the currently active connection.
// It returns the new [VPNConnection], or an error if the connection fails.
func EstablishVPN(
	ctx context.Context, conf *Config, sd transport.StreamDialer, pl transport.PacketListener,
) (_ *VPNConnection, err error) {
	if conf == nil {
		panic("a VPN config must be provided")
	}
	if sd == nil {
		panic("a StreamDialer must be provided")
	}
	if pl == nil {
		panic("a PacketListener must be provided")
	}

	c := &VPNConnection{ID: conf.ID, Status: ConnectionDisconnected}
	ctx, c.cancelEst = context.WithCancel(ctx)

	if c.platform, err = newPlatformVPNConn(conf); err != nil {
		return
	}

	c.wgEst.Add(1)
	defer c.wgEst.Done()

	if err = atomicReplaceVPNConn(c); err != nil {
		c.platform.Close()
		return
	}

	slog.Debug("establishing vpn connection ...", "id", c.ID)
	c.SetStatus(ConnectionConnecting)
	defer func() {
		if err == nil {
			c.SetStatus(ConnectionConnected)
		} else {
			c.SetStatus(ConnectionDisconnected)
		}
	}()

	if c.proxy, err = ConnectRemoteDevice(ctx, sd, pl); err != nil {
		slog.Error("failed to connect to the remote device", "err", err)
		return
	}
	slog.Info("connected to the remote device")

	if err = c.platform.Establish(ctx); err != nil {
		// No need to call c.platform.Close() cuz it's already tracked in the global conn
		return
	}

	c.wgCopy.Add(2)
	go func() {
		defer c.wgCopy.Done()
		slog.Debug("copying traffic from tun device -> remote device...")
		n, err := io.Copy(c.proxy, c.platform.TUN())
		slog.Debug("tun device -> remote device traffic done", "n", n, "err", err)
	}()
	go func() {
		defer c.wgCopy.Done()
		slog.Debug("copying traffic from remote device -> tun device...")
		n, err := io.Copy(c.platform.TUN(), c.proxy)
		slog.Debug("remote device -> tun device traffic done", "n", n, "err", err)
	}()

	slog.Info("vpn connection established", "id", c.ID)
	return c, nil
}

// CloseVPN terminates the currently active [VPNConnection] and disconnects the proxy.
func CloseVPN() error {
	mu.Lock()
	defer mu.Unlock()
	return closeVPNNoLock()
}

// atomicReplaceVPNConn atomically replaces the global conn with newConn.
func atomicReplaceVPNConn(newConn *VPNConnection) error {
	mu.Lock()
	defer mu.Unlock()
	slog.Debug("replacing the global vpn connection...", "id", newConn.ID)
	if err := closeVPNNoLock(); err != nil {
		return err
	}
	conn = newConn
	slog.Info("global vpn connection replaced", "id", newConn.ID)
	return nil
}

// closeVPNNoLock closes the current VPN connection stored in conn without acquiring
// the mutex. It is assumed that the caller holds the mutex.
func closeVPNNoLock() (err error) {
	if conn == nil {
		return nil
	}

	slog.Debug("terminating the global vpn connection...", "id", conn.ID)
	conn.SetStatus(ConnectionDisconnecting)
	defer func() {
		if err == nil {
			slog.Info("vpn connection terminated", "id", conn.ID)
			conn.SetStatus(ConnectionDisconnected)
			conn = nil
		}
	}()

	// Cancel the Establish process and wait
	conn.cancelEst()
	conn.wgEst.Wait()

	// This is the only error that matters
	if conn.platform != nil {
		err = conn.platform.Close()
	}

	// We can ignore the following error
	if conn.proxy != nil {
		if err2 := conn.proxy.Close(); err2 != nil {
			slog.Warn("failed to disconnect from the remote device")
		} else {
			slog.Info("disconnected from the remote device")
		}
	}

	// Wait for traffic copy go routines to finish
	conn.wgCopy.Wait()

	return
}
