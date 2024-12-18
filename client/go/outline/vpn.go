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

	perrs "github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/vpn"
)

type vpnConfigJSON struct {
	VPNConfig       vpn.Config `json:"vpn"`
	TransportConfig string     `json:"transport"`
}

// establishVPN establishes a VPN connection using the given configuration string.
// The configuration string should be a JSON object containing the VPN configuration
// and the transport configuration.
//
// The function returns a JSON string representing the established VPN connection,
// or an error if the connection fails.
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
	tcp, err := newFWMarkProtectedTCPDialer(conf.VPNConfig.ProtectionMark)
	if err != nil {
		return "", err
	}
	udp, err := newFWMarkProtectedUDPDialer(conf.VPNConfig.ProtectionMark)
	if err != nil {
		return "", err
	}
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

// closeVPN closes the currently active VPN connection.
func closeVPN() error {
	return vpn.CloseVPN()
}
