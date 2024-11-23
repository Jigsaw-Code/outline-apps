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

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/electron/vpnlinux"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
)

func establishVPN(ctx context.Context, config *VPNConfig) (_ *VPNConnection, perr *platerrors.PlatformError) {
	conn := &VPNConnection{}

	if conn.tun, perr = vpnlinux.ConfigureTUNDevice(config.InterfaceName); perr != nil {
		return nil, perr
	}
	defer func() {
		if perr != nil {
			conn.tun.Close()
		}
	}()

	// Configure Network Manager connection

	// Create Outline socket and protect it
	if conn.outline, perr = vpnlinux.ConfigureOutlineDevice(config.TransportConfig); perr != nil {
		return nil, perr
	}
	defer func() {
		if perr != nil {
			conn.outline.Close()
		}
	}()

	// Create routing table

	// Add IP rule to route all traffic to outline

	return conn, nil
}
