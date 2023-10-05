// Copyright 2019 The Outline Authors
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

package intra

import (
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"strings"

	"github.com/Jigsaw-Code/outline-apps/outline/tun2socks/intra/doh"
	"github.com/Jigsaw-Code/outline-apps/outline/tun2socks/intra/protect"
	"github.com/Jigsaw-Code/outline-sdk/network"
	"github.com/Jigsaw-Code/outline-sdk/network/lwip2transport"
)

// Listener receives usage statistics when a UDP or TCP socket is closed,
// or a DNS query is completed.
type Listener interface {
	UDPListener
	TCPListener
	doh.Listener
}

// Tunnel represents an Intra session.
type Tunnel struct {
	network.IPDevice

	sd  *intraStreamDialer
	pp  *intraPacketProxy
	sni *tcpSNIReporter
	tun io.Closer
}

// NewTunnel creates a connected Intra session.
//
// `fakedns` is the DNS server (IP and port) that will be used by apps on the TUN device.
//
//	This will normally be a reserved or remote IP address, port 53.
//
// `udpdns` and `tcpdns` are the actual location of the DNS server in use.
//
//	These will normally be localhost with a high-numbered port.
//
// `dohdns` is the initial DOH transport.
// `eventListener` will be notified at the completion of every tunneled socket.
func NewTunnel(
	fakedns string, dohdns doh.Transport, tun io.Closer, protector protect.Protector, eventListener Listener,
) (t *Tunnel, err error) {
	if eventListener == nil {
		return nil, errors.New("eventListener is required")
	}

	fakeDNSAddr, err := net.ResolveUDPAddr("udp", fakedns)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve fakedns: %w", err)
	}

	t = &Tunnel{
		sni: &tcpSNIReporter{
			dns: dohdns,
		},
		tun: tun,
	}

	t.sd, err = newIntraStreamDialer(fakeDNSAddr.AddrPort(), dohdns, protector, eventListener, t.sni)
	if err != nil {
		return nil, fmt.Errorf("failed to create stream dialer: %w", err)
	}

	t.pp, err = newIntraPacketProxy(fakeDNSAddr.AddrPort(), dohdns, protector, eventListener)
	if err != nil {
		return nil, fmt.Errorf("failed to create packet proxy: %w", err)
	}

	if t.IPDevice, err = lwip2transport.ConfigureDevice(t.sd, t.pp); err != nil {
		return nil, fmt.Errorf("failed to configure lwIP stack: %w", err)
	}

	t.SetDNS(dohdns)
	return
}

// Set the DNSTransport.  This method must be called before connecting the transport
// to the TUN device.  The transport can be changed at any time during operation, but
// must not be nil.
func (t *Tunnel) SetDNS(dns doh.Transport) {
	t.sd.SetDNS(dns)
	t.pp.SetDNS(dns)
	t.sni.SetDNS(dns)
}

// Enable reporting of SNIs that resulted in connection failures, using the
// Choir library for privacy-preserving error reports.  `file` is the path
// that Choir should use to store its persistent state, `suffix` is the
// authoritative domain to which reports will be sent, and `country` is a
// two-letter ISO country code for the user's current location.
func (t *Tunnel) EnableSNIReporter(filename, suffix, country string) error {
	f, err := os.OpenFile(filename, os.O_RDWR|os.O_CREATE, 0600)
	if err != nil {
		return err
	}
	return t.sni.Configure(f, suffix, strings.ToLower(country))
}

func (t *Tunnel) Disconnect() {
	t.Close()
	t.tun.Close()
}
