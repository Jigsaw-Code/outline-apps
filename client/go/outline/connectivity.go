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
	"net"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/connectivity"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
)

const (
	tcpTestWebsite = "http://example.com"
	dnsServerIP    = "1.1.1.1"
	dnsServerPort  = 53
)

// TCPAndUDPConnectivityResult represents the result of TCP and UDP connectivity checks.
//
// We use a struct instead of a tuple to preserve a strongly typed error that gobind recognizes.
type TCPAndUDPConnectivityResult struct {
	TCPError, UDPError *platerrors.PlatformError
}

// CheckTCPAndUDPConnectivity checks if a [Client] can relay TCP and UDP traffic.
//
// It parallelizes the execution of TCP and UDP checks, and returns a [TCPAndUDPConnectivityResult]
// containing a TCP error and a UDP error.
// If the connectivity check was successful, the corresponding error field will be nil.
func CheckTCPAndUDPConnectivity(client *Client) *TCPAndUDPConnectivityResult {
	// Start asynchronous UDP support check.
	udpErrChan := make(chan error)
	go func() {
		resolverAddr := &net.UDPAddr{IP: net.ParseIP(dnsServerIP), Port: dnsServerPort}
		udpErrChan <- connectivity.CheckUDPConnectivityWithDNS(client, resolverAddr)
	}()

	tcpErr := connectivity.CheckTCPConnectivityWithHTTP(client, tcpTestWebsite)
	udpErr := <-udpErrChan

	return &TCPAndUDPConnectivityResult{
		TCPError: platerrors.ToPlatformError(tcpErr),
		UDPError: platerrors.ToPlatformError(udpErr),
	}
}
