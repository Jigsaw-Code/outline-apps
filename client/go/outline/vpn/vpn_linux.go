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
	"io"
	"log/slog"
	"net"
	"sync"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline"
	perrs "github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	gonm "github.com/Wifx/gonetworkmanager/v2"
)

// linuxVPNConn implements a [VPNConnection] on Linux platform.
type linuxVPNConn struct {
	id     string
	status Status

	ctx           context.Context
	cancel        context.CancelFunc
	wgEst, wgCopy sync.WaitGroup

	tun   io.ReadWriteCloser
	proxy *outline.Device

	nmOpts *nmConnectionOptions
	nm     gonm.NetworkManager
	ac     gonm.ActiveConnection
}

var _ VPNConnection = (*linuxVPNConn)(nil)

// newVPNConnection creates a new Linux specific [VPNConnection].
// The newly connection will be [StatusDisconnected] initially, you need to call the
// Establish() in order to make it [StatusConnected].
func newVPNConnection(conf *configJSON) (_ *linuxVPNConn, err error) {
	c := &linuxVPNConn{
		id:     conf.ID,
		status: StatusDisconnected,
		nmOpts: &nmConnectionOptions{
			Name:            conf.ConnectionName,
			TUNName:         conf.InterfaceName,
			TUNAddr4:        net.ParseIP(conf.IPAddress).To4(),
			DNSServers4:     make([]net.IP, 0, 2),
			FWMark:          conf.ProtectionMark,
			RoutingTable:    conf.RoutingTableId,
			RoutingPriority: conf.RoutingPriority,
		},
	}

	if c.nmOpts.Name == "" {
		return nil, errIllegalConfig("must provide a valid connection name")
	}
	if c.nmOpts.TUNName == "" {
		return nil, errIllegalConfig("must provide a valid TUN interface name")
	}
	if c.nmOpts.TUNAddr4 == nil {
		return nil, errIllegalConfig("must provide a valid TUN interface IP(v4)")
	}
	for _, dns := range conf.DNSServers {
		dnsIP := net.ParseIP(dns).To4()
		if dnsIP == nil {
			return nil, errIllegalConfig("DNS server must be a valid IP(v4)", "dns", dns)
		}
		c.nmOpts.DNSServers4 = append(c.nmOpts.DNSServers4, dnsIP)
	}
	if conf.TransportConfig == "" {
		return nil, errIllegalConfig("must provide a transport config")
	}

	c.proxy, err = outline.NewDevice(conf.TransportConfig, &outline.DeviceOptions{
		LinuxOpts: &outline.LinuxOptions{
			FWMark: c.nmOpts.FWMark,
		},
	})
	if err != nil {
		return
	}

	c.ctx, c.cancel = context.WithCancel(context.Background())
	return c, nil
}

func (c *linuxVPNConn) ID() string         { return c.id }
func (c *linuxVPNConn) Status() Status     { return c.status }
func (c *linuxVPNConn) SupportsUDP() *bool { return c.proxy.SupportsUDP() }

// Establish tries to establish this [VPNConnection], and makes it [StatusConnected].
func (c *linuxVPNConn) Establish() (err error) {
	c.wgEst.Add(1)
	defer c.wgEst.Done()
	if c.ctx.Err() != nil {
		return &perrs.PlatformError{Code: perrs.OperationCanceled}
	}

	c.status = StatusConnecting
	defer func() {
		if err == nil {
			c.status = StatusConnected
		} else {
			c.status = StatusUnknown
		}
	}()

	if err = c.proxy.Connect(); err != nil {
		return
	}
	if c.tun, err = newTUNDevice(c.nmOpts.TUNName); err != nil {
		return errSetupVPN(ioLogPfx, "failed to create TUN device", err, "name", c.nmOpts.Name)
	}
	slog.Info(vpnLogPfx+"TUN device created", "name", c.nmOpts.TUNName)
	if err = c.establishNMConnection(); err != nil {
		return
	}

	c.wgCopy.Add(2)
	go func() {
		defer c.wgCopy.Done()
		slog.Debug(ioLogPfx + "Copying traffic from TUN Device -> OutlineDevice...")
		n, err := io.Copy(c.proxy, c.tun)
		slog.Debug(ioLogPfx+"TUN Device -> OutlineDevice done", "n", n, "err", err)
	}()
	go func() {
		defer c.wgCopy.Done()
		slog.Debug(ioLogPfx + "Copying traffic from OutlineDevice -> TUN Device...")
		n, err := io.Copy(c.tun, c.proxy)
		slog.Debug(ioLogPfx+"OutlineDevice -> TUN Device done", "n", n, "err", err)
	}()

	return nil
}

// Close tries to close this [VPNConnection] and make it [StatusDisconnected].
func (c *linuxVPNConn) Close() (err error) {
	if c == nil {
		return nil
	}

	c.status = StatusDisconnecting
	defer func() {
		if err == nil {
			c.status = StatusDisconnected
		} else {
			c.status = StatusUnknown
		}
	}()

	c.cancel()
	c.wgEst.Wait()

	c.closeNMConnection()
	if c.tun != nil {
		// this is the only error that matters
		if err = c.tun.Close(); err != nil {
			err = errCloseVPN(vpnLogPfx, "failed to close TUN device", err, "name", c.nmOpts.TUNName)
		} else {
			slog.Info(vpnLogPfx+"closed TUN device", "name", c.nmOpts.TUNName)
		}
	}
	c.proxy.Close()

	// Wait for traffic copy go routines to finish
	c.wgCopy.Wait()
	return
}
