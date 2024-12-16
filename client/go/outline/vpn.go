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

package outline

import (
	"encoding/json"
	"net"

	perrs "github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/vpn"
)

type vpnConfigJSON struct {
	VPNConfig       vpn.Config `json:"vpn"`
	TransportConfig string     `json:"transport"`
}

func establishVPN(configStr string) (string, error) {
	var conf vpnConfigJSON
	if err := json.Unmarshal([]byte(configStr), &conf); err != nil {
		return "", perrs.PlatformError{
			Code:    perrs.IllegalConfig,
			Message: "invalid VPN config format",
			Cause:   perrs.ToPlatformError(err),
		}
	}

	// Create Outline Client and Device
	tcpControl, err := vpn.TCPDialerControl(&conf.VPNConfig)
	if err != nil {
		return "", err
	}
	tcp := net.Dialer{
		Control:   tcpControl,
		KeepAlive: -1,
	}
	udpControl, err := vpn.UDPDialerControl(&conf.VPNConfig)
	if err != nil {
		return "", err
	}
	udp := net.Dialer{Control: udpControl}
	c, err := newClientWithBaseDialers(conf.TransportConfig, tcp, udp)
	if err != nil {
		return "", err
	}
	proxy, err := NewDevice(c)
	if err != nil {
		return "", err
	}

	// Establish system VPN to the proxy
	conn, err := vpn.EstablishVPN(&conf.VPNConfig, proxy)
	if err != nil {
		return "", err
	}

	connJson, err := json.Marshal(conn)
	if err != nil {
		return "", perrs.PlatformError{
			Code:    perrs.InternalError,
			Message: "failed to return VPN connection as JSON",
			Cause:   perrs.ToPlatformError(err),
		}
	}
	return string(connJson), nil
}

func closeVPN() error {
	return vpn.CloseVPN()
}
