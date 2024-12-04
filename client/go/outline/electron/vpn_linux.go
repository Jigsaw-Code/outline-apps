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
	"io"
	"log/slog"
	"net"
	"sync"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/electron/vpnlinux"
	perrs "github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
)

type linuxVPNConn struct {
	id     string
	status VPNStatus

	fwmark      uint32
	tunName     string
	tunCidr     *net.IPNet
	dnsIP       net.IP
	rtID, rtPri int

	ctx           context.Context
	cancel        context.CancelFunc
	wgEst, wgCopy sync.WaitGroup

	outline *outlineDevice

	tun    *vpnlinux.TUNDevice
	nmConn *vpnlinux.NMConnection
	route  *vpnlinux.RoutingRule
}

var _ VPNConnection = (*linuxVPNConn)(nil)

func newVPNConnection(conf *vpnConfigJSON) (_ *linuxVPNConn, perr *perrs.PlatformError) {
	c := &linuxVPNConn{
		id:      conf.ID,
		status:  VPNDisconnected,
		tunName: conf.InterfaceName,
		fwmark:  conf.ProtectionMark,
		rtID:    conf.RoutingTableId,
		rtPri:   conf.RoutingPriority,
	}

	if c.tunName == "" {
		return nil, perrs.NewPlatformError(perrs.IllegalConfig, "TUN interface name is required")
	}
	if conf.IPAddress == "" {
		return nil, perrs.NewPlatformError(perrs.IllegalConfig, "TUN IP is required")
	}
	_, cidr, err := net.ParseCIDR(conf.IPAddress + "/32")
	if c.tunCidr = cidr; err != nil {
		return nil, perrs.NewPlatformError(perrs.IllegalConfig, "TUN IP is invalid")
	}
	if c.dnsIP = net.ParseIP(conf.DNSServers[0]); c.dnsIP == nil {
		return nil, perrs.NewPlatformError(perrs.IllegalConfig, "DNS IP is invalid")
	}
	if c.rtID < 0 {
		return nil, perrs.NewPlatformError(perrs.IllegalConfig, "Routing Table ID must be greater than 0")
	}
	if c.rtPri < 0 {
		return nil, perrs.NewPlatformError(perrs.IllegalConfig, "Routing Priority must be greater than 0")
	}
	if conf.TransportConfig == "" {
		return nil, perrs.NewPlatformError(perrs.IllegalConfig, "transport config is required")
	}
	if c.outline, perr = newOutlineDevice(conf.TransportConfig, c.fwmark); perr != nil {
		return
	}

	c.ctx, c.cancel = context.WithCancel(context.Background())
	return c, nil
}

func (c *linuxVPNConn) ID() string        { return c.id }
func (c *linuxVPNConn) Status() VPNStatus { return c.status }
func (c *linuxVPNConn) RouteUDP() *bool   { return c.outline.RouteUDP() }

func (c *linuxVPNConn) Establish() (perr *perrs.PlatformError) {
	c.wgEst.Add(1)
	defer c.wgEst.Done()
	if c.ctx.Err() != nil {
		return &perrs.PlatformError{Code: perrs.OperationCanceled}
	}

	c.status = VPNConnecting
	defer func() {
		if perr == nil {
			c.status = VPNConnected
		} else {
			c.status = VPNDisconnected
		}
	}()

	if perr = c.outline.Connect(); perr != nil {
		return
	}

	if c.tun, perr = vpnlinux.NewTUNDevice(c.tunName, c.tunCidr); perr != nil {
		return
	}
	if c.nmConn, perr = vpnlinux.NewNMConnection(c.tun, c.dnsIP); perr != nil {
		return
	}
	if c.route, perr = vpnlinux.NewRoutingRule(c.tun, c.rtID, c.rtPri, c.fwmark); perr != nil {
		return
	}

	c.wgCopy.Add(2)
	go func() {
		defer c.wgCopy.Done()
		slog.Debug("Copying traffic from TUN Device -> OutlineDevice...")
		n, err := io.Copy(c.outline, c.tun.File)
		slog.Debug("TUN Device -> OutlineDevice done", "n", n, "err", err)
	}()
	go func() {
		defer c.wgCopy.Done()
		slog.Debug("Copying traffic from OutlineDevice -> TUN Device...")
		n, err := io.Copy(c.tun.File, c.outline)
		slog.Debug("OutlineDevice -> TUN Device done", "n", n, "err", err)
	}()

	return nil
}

func (c *linuxVPNConn) Close() (perr *perrs.PlatformError) {
	if c == nil {
		return nil
	}

	prevStatus := c.status
	c.status = VPNDisconnecting
	defer func() {
		if perr == nil {
			c.status = VPNDisconnected
		} else {
			c.status = prevStatus
		}
	}()

	c.cancel()
	c.wgEst.Wait()

	if c.route != nil {
		perr = c.route.Close()
	}

	// All following errors are harmless and can be ignored.
	if err := c.nmConn.Close(); err == nil {
		c.nmConn = nil
	}
	if err := c.tun.Close(); err == nil {
		c.tun = nil
	}
	c.outline.Close()

	// Wait for traffic copy go routines to finish
	c.wgCopy.Wait()
	return
}
