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

package connectivity

import (
	"context"
	"net"
	"net/http"
	"time"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

// TODO: make these values configurable by exposing a struct with the connectivity methods.
const (
	tcpTimeout          = 10 * time.Second
	udpTimeout          = 1 * time.Second
	udpMaxRetryAttempts = 5
	bufferLength        = 512
)

const (
	testTCPWebsite    = "http://example.com"
	testDNSServerIP   = "1.1.1.1"
	testDNSServerPort = 53
)

// CheckTCPAndUDPConnectivity checks whether the given `tcp` and `udp` clients can relay traffic.
//
// It parallelizes the execution of TCP and UDP checks, and returns a TCP error and a UDP error.
// A nil error indicates successful connectivity for the corresponding protocol.
func CheckTCPAndUDPConnectivity(
	tcp transport.StreamDialer, udp transport.PacketListener,
) (tcpErr error, udpErr error) {
	// Start asynchronous UDP support check.
	udpErrChan := make(chan error)
	go func() {
		resolverAddr := &net.UDPAddr{IP: net.ParseIP(testDNSServerIP), Port: testDNSServerPort}
		udpErrChan <- CheckUDPConnectivityWithDNS(udp, resolverAddr)
	}()

	tcpErr = CheckTCPConnectivityWithHTTP(tcp, testTCPWebsite)
	udpErr = <-udpErrChan
	return
}

// CheckUDPConnectivityWithDNS determines whether the Outline proxy represented by `client` and
// the network support UDP traffic by issuing a DNS query though a resolver at `resolverAddr`.
// Returns nil on success or an error on failure.
func CheckUDPConnectivityWithDNS(client transport.PacketListener, resolverAddr net.Addr) error {
	conn, err := client.ListenPacket(context.Background())
	if err != nil {
		return platerrors.PlatformError{
			Code:    platerrors.ProxyServerUDPUnsupported,
			Message: "failed to listen for UDP packets",
			Cause:   platerrors.ToPlatformError(err),
		}
	}
	defer conn.Close()

	buf := make([]byte, bufferLength)
	for attempt := 0; attempt < udpMaxRetryAttempts; attempt++ {
		conn.SetDeadline(time.Now().Add(udpTimeout))
		_, err := conn.WriteTo(getDNSRequest(), resolverAddr)
		if err != nil {
			continue
		}
		n, addr, err := conn.ReadFrom(buf)
		if n == 0 && err != nil {
			continue
		}
		if addr.String() != resolverAddr.String() {
			continue // Ensure we got a response from the resolver.
		}
		return nil
	}

	return platerrors.PlatformError{
		Code:    platerrors.ProxyServerUDPUnsupported,
		Message: "UDP connectivity check timed out",
	}
}

// CheckTCPConnectivityWithHTTP determines whether the proxy is reachable over TCP and validates the
// client's authentication credentials by performing an HTTP HEAD request to `targetURL`, which must
// be of the form: http://[host](:[port])(/[path]).
//
// Returns nil on success, error on connectivity failure.
func CheckTCPConnectivityWithHTTP(dialer transport.StreamDialer, targetURL string) error {
	deadline := time.Now().Add(tcpTimeout)
	ctx, cancel := context.WithDeadline(context.Background(), deadline)
	defer cancel()
	req, err := http.NewRequest("HEAD", targetURL, nil)
	if err != nil {
		return err
	}
	targetAddr := req.Host
	if !hasPort(targetAddr) {
		targetAddr = net.JoinHostPort(targetAddr, "80")
	}
	conn, err := dialer.DialStream(ctx, targetAddr)
	if err != nil {
		return platerrors.PlatformError{
			Code:    platerrors.ProxyServerUnreachable,
			Message: "failed to dial to the server",
			Cause:   platerrors.ToPlatformError(err),
		}
	}
	defer conn.Close()
	conn.SetDeadline(deadline)
	err = req.Write(conn)
	if err != nil {
		return platerrors.PlatformError{
			Code:    platerrors.ProxyServerWriteFailed,
			Message: "failed to write HTTP HEAD to the server",
			Cause:   platerrors.ToPlatformError(err),
		}
	}
	n, err := conn.Read(make([]byte, bufferLength))
	if n == 0 && err != nil {
		return platerrors.PlatformError{
			Code:    platerrors.ProxyServerReadFailed,
			Message: "failed to read HTTP HEAD response from the server",
			Cause:   platerrors.ToPlatformError(err),
		}
	}
	return nil
}

func getDNSRequest() []byte {
	return []byte{
		0, 0, // [0-1]   query ID
		1, 0, // [2-3]   flags; byte[2] = 1 for recursion desired (RD).
		0, 1, // [4-5]   QDCOUNT (number of queries)
		0, 0, // [6-7]   ANCOUNT (number of answers)
		0, 0, // [8-9]   NSCOUNT (number of name server records)
		0, 0, // [10-11] ARCOUNT (number of additional records)
		3, 'c', 'o', 'm',
		0,    // null terminator of FQDN (root TLD)
		0, 1, // QTYPE, set to A
		0, 1, // QCLASS, set to 1 = IN (Internet)
	}
}

func hasPort(hostPort string) bool {
	_, _, err := net.SplitHostPort(hostPort)
	return err == nil
}
