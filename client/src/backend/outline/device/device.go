// Copyright 2023 The Outline Authors
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

package device

import (
	"fmt"

	"github.com/Jigsaw-Code/outline-sdk/network"
	"github.com/Jigsaw-Code/outline-sdk/network/lwip2transport"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

const (
	connectivityTestDNSResolver  = "1.1.1.1:53"
	connectivityTestTargetDomain = "www.google.com"
)

// OutlineDevice delegates the TCP and UDP traffic from local machine to the remote Outline server.
type OutlineDevice struct {
	t2s network.IPDevice
	pp  *outlinePacketProxy
	sd  transport.StreamDialer
}

// NewOutlineDevice creates a new [OutlineDevice] that can relay traffic to a remote Outline server.
func NewOutlineDevice(configJSON string) (d *OutlineDevice, err error) {
	config, err := parseConfigFromJSON(configJSON)
	if err != nil {
		return nil, err
	}

	d = &OutlineDevice{}

	if d.sd, err = newOutlineStreamDialer(config); err != nil {
		return nil, fmt.Errorf("failed to create TCP dialer: %w", err)
	}

	if d.pp, err = newOutlinePacketProxy(config); err != nil {
		return nil, fmt.Errorf("failed to create UDP proxy: %w", err)
	}

	if d.t2s, err = lwip2transport.ConfigureDevice(d.sd, d.pp); err != nil {
		return nil, fmt.Errorf("failed to configure lwIP: %w", err)
	}

	return
}

func (d *OutlineDevice) Close() error {
	return d.t2s.Close()
}

func (d *OutlineDevice) Refresh() error {
	return d.pp.testConnectivityAndRefresh(connectivityTestDNSResolver, connectivityTestTargetDomain)
}
