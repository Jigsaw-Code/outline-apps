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
	"errors"
	"io"
	"log/slog"
	"sync"

	"github.com/Jigsaw-Code/outline-sdk/network"
)

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

type ProxyDevice interface {
	network.IPDevice
	Connect(ctx context.Context) error
	SupportsUDP() bool
	RefreshConnectivity(ctx context.Context) error
}

type platformVPNConn interface {
	Establish(ctx context.Context) error
	TUN() io.ReadWriteCloser
	Close() error
}

// VPNConnection is a platform neutral interface of a VPN connection.
type VPNConnection struct {
	ID          string `json:"id"`
	Status      Status `json:"status"`
	SupportsUDP *bool  `json:"supportsUDP"`

	ctx           context.Context
	cancel        context.CancelFunc
	wgEst, wgCopy sync.WaitGroup

	proxy    ProxyDevice
	platform platformVPNConn
}

func (c *VPNConnection) SetStatus(s Status) {
	c.Status = s
}

func (c *VPNConnection) SetSupportsUDP(v bool) {
	c.SupportsUDP = &v
}

// The global singleton VPN connection.
// This package allows at most one active VPN connection at the same time.
var mu sync.Mutex
var conn *VPNConnection

// EstablishVPN establishes a new active [VPNConnection] with the given configuration.
// It will first close any active [VPNConnection] using [CloseVPN], and then mark the
// newly created [VPNConnection] as the currently active connection.
// It returns the connectionJSON as a string, or an error if the connection fails.
func EstablishVPN(conf *Config, proxy ProxyDevice) (_ *VPNConnection, err error) {
	if conf == nil {
		return nil, errors.New("a VPN Config must be provided")
	}
	if proxy == nil {
		return nil, errors.New("a proxy device must be provided")
	}

	c := &VPNConnection{
		ID:     conf.ID,
		Status: StatusDisconnected,
	}
	c.ctx, c.cancel = context.WithCancel(context.Background())
	if c.platform, err = newPlatformVPNConn(conf); err != nil {
		return
	}

	c.wgEst.Add(1)
	defer c.wgEst.Done()

	if err = atomicReplaceVPNConn(c); err != nil {
		c.platform.Close()
		return
	}

	slog.Debug(vpnLogPfx+"Establishing VPN connection ...", "id", c.ID)

	c.SetStatus(StatusConnecting)
	defer func() {
		if err == nil {
			c.SetStatus(StatusConnected)
		} else {
			c.SetStatus(StatusUnknown)
		}
	}()

	if err = c.proxy.Connect(c.ctx); err != nil {
		slog.Error(proxyLogPfx+"Failed to connect to the proxy", "err", err)
		return
	}
	slog.Info(proxyLogPfx + "Connected to the proxy")
	c.SetSupportsUDP(c.proxy.SupportsUDP())

	if err = c.platform.Establish(c.ctx); err != nil {
		// No need to call c.platform.Close() cuz it's already tracked in the global conn
		return
	}

	c.wgCopy.Add(2)
	go func() {
		defer c.wgCopy.Done()
		slog.Debug(ioLogPfx + "Copying traffic from TUN Device -> OutlineDevice...")
		n, err := io.Copy(c.proxy, c.platform.TUN())
		slog.Debug(ioLogPfx+"TUN Device -> OutlineDevice done", "n", n, "err", err)
	}()
	go func() {
		defer c.wgCopy.Done()
		slog.Debug(ioLogPfx + "Copying traffic from OutlineDevice -> TUN Device...")
		n, err := io.Copy(c.platform.TUN(), c.proxy)
		slog.Debug(ioLogPfx+"OutlineDevice -> TUN Device done", "n", n, "err", err)
	}()

	slog.Info(vpnLogPfx+"VPN connection established", "id", c.ID)
	return c, nil
}

// CloseVPN closes the currently active [VPNConnection].
func CloseVPN() error {
	mu.Lock()
	defer mu.Unlock()
	return closeVPNNoLock()
}

// atomicReplaceVPNConn atomically replaces the global conn with newConn.
func atomicReplaceVPNConn(newConn *VPNConnection) error {
	mu.Lock()
	defer mu.Unlock()
	slog.Debug(vpnLogPfx+"Creating VPN Connection ...", "id", newConn.ID)
	if err := closeVPNNoLock(); err != nil {
		return err
	}
	conn = newConn
	slog.Info(vpnLogPfx+"VPN Connection created", "id", newConn.ID)
	return nil
}

// closeVPNNoLock closes the current VPN connection stored in conn without acquiring
// the mutex. It is assumed that the caller holds the mutex.
func closeVPNNoLock() (err error) {
	if conn == nil {
		return nil
	}

	conn.SetStatus(StatusDisconnecting)
	defer func() {
		if err == nil {
			conn.SetStatus(StatusDisconnected)
		} else {
			conn.SetStatus(StatusUnknown)
		}
	}()

	slog.Debug(vpnLogPfx+"Closing existing VPN Connection ...", "id", conn.ID)

	// Cancel the Establish process and wait
	conn.cancel()
	conn.wgEst.Wait()

	if err = conn.platform.Close(); err == nil {
		slog.Info(vpnLogPfx+"VPN Connection closed", "id", conn.ID)
		conn = nil
	}

	// We can ignore the following error
	if err2 := conn.proxy.Close(); err2 != nil {
		slog.Warn(proxyLogPfx + "Failed to disconnect from the proxy")
	} else {
		slog.Info(proxyLogPfx + "Disconnected from the proxy")
	}

	// Wait for traffic copy go routines to finish
	conn.wgCopy.Wait()

	return
}
