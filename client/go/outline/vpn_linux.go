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
	"context"
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
// The function returns a non-nil error if the connection fails.
func establishVPN(configStr string) error {
	var conf vpnConfigJSON
	if err := json.Unmarshal([]byte(configStr), &conf); err != nil {
		return perrs.PlatformError{
			Code:    perrs.InvalidConfig,
			Message: "invalid VPN config format",
			Cause:   perrs.ToPlatformError(err),
		}
	}

	tcp := newFWMarkProtectedTCPDialer(conf.VPNConfig.ProtectionMark)
	udp := newFWMarkProtectedUDPDialer(conf.VPNConfig.ProtectionMark)
	c, err := newClientWithBaseDialers(conf.TransportConfig, tcp, udp)
	if err != nil {
		return err
	}

	_, err = vpn.EstablishVPN(context.Background(), &conf.VPNConfig, c, c)
	return err
}

// closeVPN closes the currently active VPN connection.
func closeVPN() error {
	return vpn.CloseVPN()
}
