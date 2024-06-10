// Copyright 2022 The Outline Authors
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

// This package provides support of Shadowsocks client and the configuration
// that can be used by Outline Client.
//
// All data structures and functions will also be exposed as libraries that
// non-golang callers can use (for example, C/Java/Objective-C).
package shadowsocks

import (
	"fmt"
	"net"
	"strconv"
	"time"

	"github.com/Jigsaw-Code/outline-apps/client/src/tun2socks/outline"
	"github.com/Jigsaw-Code/outline-apps/client/src/tun2socks/outline/connectivity"
	"github.com/Jigsaw-Code/outline-apps/client/src/tun2socks/outline/internal/utf8"
	"github.com/Jigsaw-Code/outline-apps/client/src/tun2socks/outline/platerrors"
	"github.com/Jigsaw-Code/outline-sdk/transport"
	"github.com/Jigsaw-Code/outline-sdk/transport/shadowsocks"
	"github.com/eycorsican/go-tun2socks/common/log"
)

// A client object that can be used to connect to a remote Shadowsocks proxy.
type Client outline.Client

// NewClient creates a new Shadowsocks client from a non-nil configuration.
//
// Deprecated: Please use NewClientFromJSON.
func NewClient(config *Config) (*Client, error) {
	if config == nil {
		return nil, newIllegalConfigErrorWithDetails("Shadowsocks config must be provided", ".", config, "not nil", nil)
	}
	return newShadowsocksClient(config.Host, config.Port, config.CipherName, config.Password, config.Prefix)
}

// NewClientFromJSON creates a new Shadowsocks client from a JSON formatted configuration.
func NewClientFromJSON(configJSON string) (*Client, error) {
	config, err := parseConfigFromJSON(configJSON)
	if err != nil {
		return nil, newIllegalConfigErrorWithDetails("Shadowsocks config must be a valid JSON string", ".", configJSON, "JSON string", err)
	}
	var prefixBytes []byte = nil
	if len(config.Prefix) > 0 {
		if p, err := utf8.DecodeUTF8CodepointsToRawBytes(config.Prefix); err != nil {
			return nil, newIllegalConfigErrorWithDetails("prefix is not valid", "prefix", config.Prefix, "string in utf-8", err)
		} else {
			prefixBytes = p
		}
	}
	return newShadowsocksClient(config.Host, int(config.Port), config.Method, config.Password, prefixBytes)
}

func newShadowsocksClient(host string, port int, cipherName, password string, prefix []byte) (*Client, error) {
	if err := validateConfig(host, port, cipherName, password); err != nil {
		return nil, err
	}

	// TODO: consider using net.LookupIP to get a list of IPs, and add logic for optimal selection.
	proxyIP, err := net.ResolveIPAddr("ip", host)
	if err != nil {
		return nil, platerrors.NewWithCause(platerrors.ResolveIPFailed, "failed to resolve ip of the proxy host", err)
	}
	proxyAddress := net.JoinHostPort(proxyIP.String(), fmt.Sprint(port))

	cryptoKey, err := shadowsocks.NewEncryptionKey(cipherName, password)
	if err != nil {
		return nil, newIllegalConfigErrorWithDetails("cipher&password pair is not valid",
			"cipher|password", cipherName+"|"+password, "valid combination", err)
	}

	// We disable Keep-Alive as per https://datatracker.ietf.org/doc/html/rfc1122#page-101, which states that it should only be
	// enabled in server applications. This prevents the device from unnecessarily waking up to send keep alives.
	streamDialer, err := shadowsocks.NewStreamDialer(&transport.TCPEndpoint{Address: proxyAddress, Dialer: net.Dialer{KeepAlive: -1}}, cryptoKey)
	if err != nil {
		return nil, platerrors.NewWithDetailsCause(platerrors.SetupTrafficHandlerFailed, "failed to create TCP traffic handler",
			platerrors.ErrorDetails{"proxy-protocol": "shadowsocks", "handler": "tcp"}, err)
	}
	if len(prefix) > 0 {
		log.Debugf("Using salt prefix: %s", string(prefix))
		streamDialer.SaltGenerator = shadowsocks.NewPrefixSaltGenerator(prefix)
	}

	packetListener, err := shadowsocks.NewPacketListener(&transport.UDPEndpoint{Address: proxyAddress}, cryptoKey)
	if err != nil {
		return nil, platerrors.NewWithDetailsCause(platerrors.SetupTrafficHandlerFailed, "failed to create UDP traffic handler",
			platerrors.ErrorDetails{"proxy-protocol": "shadowsocks", "handler": "udp"}, err)
	}

	return &Client{StreamDialer: streamDialer, PacketListener: packetListener}, nil
}

// Error number constants exported through gomobile
const (
	NoError                     = 0
	Unexpected                  = 1
	NoVPNPermissions            = 2 // Unused
	AuthenticationFailure       = 3
	UDPConnectivity             = 4
	Unreachable                 = 5
	VpnStartFailure             = 6  // Unused
	IllegalConfiguration        = 7  // Electron only
	ShadowsocksStartFailure     = 8  // Unused
	ConfigureSystemProxyFailure = 9  // Unused
	NoAdminPermissions          = 10 // Unused
	UnsupportedRoutingTable     = 11 // Unused
	SystemMisconfigured         = 12 // Electron only
)

const reachabilityTimeout = 10 * time.Second

// CheckConnectivity determines whether the Shadowsocks proxy can relay TCP and UDP traffic under
// the current network. Parallelizes the execution of TCP and UDP checks, selects the appropriate
// error code to return accounting for transient network failures.
// Returns an error if an unexpected error ocurrs.
func CheckConnectivity(client *Client) (int, error) {
	errCode, err := connectivity.CheckConnectivity((*outline.Client)(client))
	return errCode.Number(), err
}

// CheckServerReachable determines whether the server at `host:port` is reachable over TCP.
// Returns an error if the server is unreachable.
func CheckServerReachable(host string, port int) error {
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, strconv.Itoa(port)), reachabilityTimeout)
	if err != nil {
		return err
	}
	conn.Close()
	return nil
}
