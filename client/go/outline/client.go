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

package outline

import (
	"fmt"
	"net"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/connectivity"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-sdk/transport"
	"github.com/Jigsaw-Code/outline-sdk/transport/shadowsocks"
	"github.com/eycorsican/go-tun2socks/common/log"
)

// Client provides a transparent container for [transport.StreamDialer] and [transport.PacketListener]
// that is exportable (as an opaque object) via gobind.
// It's used by the connectivity test and the tun2socks handlers.
type Client struct {
	transport.StreamDialer
	transport.PacketListener
}

// NewClientResult represents the result of [NewClientAndReturnError].
//
// We use a struct instead of a tuple to preserve a strongly typed error that gobind recognizes.
type NewClientResult struct {
	Client *Client
	Error  *platerrors.PlatformError
}

// NewClientAndReturnError creates a new Outline client from a configuration string.
//
// TODO: rename this function to NewClient once all platforms have switched from the old NewClient
func NewClientAndReturnError(transportConfig string) *NewClientResult {
	client, err := NewClient(transportConfig)
	return &NewClientResult{
		Client: client,
		Error:  platerrors.ToPlatformError(err),
	}
}

// NewClient creates a new Outline client from a configuration string.
//
// Deprecated: Use [NewClientAndReturnError] instead.
func NewClient(transportConfig string) (*Client, error) {
	// TODO: use normalized format.
	config, err := parseConfigFromJSON(transportConfig)
	if err != nil {
		return nil, err
	}
	prefixBytes, err := ParseConfigPrefixFromString(config.Prefix)
	if err != nil {
		return nil, err
	}
	return newShadowsocksClient(config.Host, int(config.Port), config.Method, config.Password, prefixBytes)
}

func newShadowsocksClient(host string, port int, cipherName, password string, prefix []byte) (*Client, error) {
	if err := validateConfig(host, port, cipherName, password); err != nil {
		return nil, err
	}

	// TODO: consider using net.LookupIP to get a list of IPs, and add logic for optimal selection.
	proxyAddress := net.JoinHostPort(host, fmt.Sprint(port))

	cryptoKey, err := shadowsocks.NewEncryptionKey(cipherName, password)
	if err != nil {
		return nil, newIllegalConfigErrorWithDetails("cipher&password pair is not valid",
			"cipher|password", cipherName+"|"+password, "valid combination", err)
	}

	// We disable Keep-Alive as per https://datatracker.ietf.org/doc/html/rfc1122#page-101, which states that it should only be
	// enabled in server applications. This prevents the device from unnecessarily waking up to send keep alives.
	streamDialer, err := shadowsocks.NewStreamDialer(&transport.TCPEndpoint{Address: proxyAddress, Dialer: net.Dialer{KeepAlive: -1}}, cryptoKey)
	if err != nil {
		return nil, platerrors.PlatformError{
			Code:    platerrors.SetupTrafficHandlerFailed,
			Message: "failed to create TCP traffic handler",
			Details: platerrors.ErrorDetails{"proxy-protocol": "shadowsocks", "handler": "tcp"},
			Cause:   platerrors.ToPlatformError(err),
		}
	}
	if len(prefix) > 0 {
		log.Debugf("Using salt prefix: %s", string(prefix))
		streamDialer.SaltGenerator = shadowsocks.NewPrefixSaltGenerator(prefix)
	}

	packetListener, err := shadowsocks.NewPacketListener(&transport.UDPEndpoint{Address: proxyAddress}, cryptoKey)
	if err != nil {
		return nil, platerrors.PlatformError{
			Code:    platerrors.SetupTrafficHandlerFailed,
			Message: "failed to create UDP traffic handler",
			Details: platerrors.ErrorDetails{"proxy-protocol": "shadowsocks", "handler": "udp"},
			Cause:   platerrors.ToPlatformError(err),
		}
	}

	return &Client{StreamDialer: streamDialer, PacketListener: packetListener}, nil
}

// Error number constants exported through gomobile
//
// Deprecated: Use [platerrors.PlatformError] instead.
const (
	NoError                     = 0
	Unexpected                  = 1
	NoVPNPermissions            = 2 // Unused
	AuthenticationFailure       = 3
	UDPConnectivity             = 4
	Unreachable                 = 5
	VpnStartFailure             = 6  // Unused
	IllegalConfiguration        = 7  // Electron only
	ClientStartFailure          = 8  // Unused
	ConfigureSystemProxyFailure = 9  // Unused
	NoAdminPermissions          = 10 // Unused
	UnsupportedRoutingTable     = 11 // Unused
	SystemMisconfigured         = 12 // Electron only
)

// CheckConnectivity determines whether the client can relay TCP and UDP traffic under
// the current network. Parallelizes the execution of TCP and UDP checks, selects the appropriate
// error code to return accounting for transient network failures.
// Returns an error if an unexpected error ocurrs.
//
// Deprecated: Use [CheckTCPAndUDPConnectivity] instead.
func CheckConnectivity(client *Client) (int, error) {
	errCode, err := connectivity.CheckConnectivity(client, client)
	return errCode.Number(), err
}
