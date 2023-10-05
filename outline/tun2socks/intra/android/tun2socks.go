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

package tun2socks

import (
	"errors"
	"io"
	"io/fs"
	"log"
	"os"
	"strings"

	"github.com/Jigsaw-Code/outline-apps/outline/tun2socks/intra"
	"github.com/Jigsaw-Code/outline-apps/outline/tun2socks/intra/doh"
	"github.com/Jigsaw-Code/outline-apps/outline/tun2socks/intra/protect"
	"github.com/Jigsaw-Code/outline-sdk/network"
)

// ConnectIntraTunnel reads packets from a TUN device and applies the Intra routing
// rules.  Currently, this only consists of redirecting DNS packets to a specified
// server; all other data flows directly to its destination.
//
// `fd` is the TUN device.  The IntraTunnel acquires an additional reference to it, which
//
//	is released by IntraTunnel.Disconnect(), so the caller must close `fd` _and_ call
//	Disconnect() in order to close the TUN device.
//
// `fakedns` is the DNS server that the system believes it is using, in "host:port" style.
//
//	The port is normally 53.
//
// `udpdns` and `tcpdns` are the location of the actual DNS server being used.  For DNS
//
//	tunneling in Intra, these are typically high-numbered ports on localhost.
//
// `dohdns` is the initial DoH transport.  It must not be `nil`.
// `protector` is a wrapper for Android's VpnService.protect() method.
// `eventListener` will be provided with a summary of each TCP and UDP socket when it is closed.
//
// Throws an exception if the TUN file descriptor cannot be opened, or if the tunnel fails to
// connect.
func ConnectIntraTunnel(
	fd int, fakedns string, dohdns doh.Transport, protector protect.Protector, eventListener intra.Listener,
) (*intra.Tunnel, error) {
	tun, err := makeTunFile(fd)
	if err != nil {
		return nil, err
	}
	t, err := intra.NewTunnel(fakedns, dohdns, tun, protector, eventListener)
	if err != nil {
		return nil, err
	}
	go copyUntilEOF(t, tun)
	go copyUntilEOF(tun, t)
	return t, nil
}

// NewDoHTransport returns a DNSTransport that connects to the specified DoH server.
// `url` is the URL of a DoH server (no template, POST-only).  If it is nonempty, it
//
//	overrides `udpdns` and `tcpdns`.
//
// `ips` is an optional comma-separated list of IP addresses for the server.  (This
//
//	wrapper is required because gomobile can't make bindings for []string.)
//
// `protector` is the socket protector to use for all external network activity.
// `auth` will provide a client certificate if required by the TLS server.
// `eventListener` will be notified after each DNS query succeeds or fails.
func NewDoHTransport(
	url string, ips string, protector protect.Protector, auth doh.ClientAuth, eventListener intra.Listener,
) (doh.Transport, error) {
	split := []string{}
	if len(ips) > 0 {
		split = strings.Split(ips, ",")
	}
	dialer := protect.MakeDialer(protector)
	return doh.NewTransport(url, split, dialer, auth, eventListener)
}

func copyUntilEOF(dst, src io.ReadWriteCloser) {
	log.Printf("[debug] start relaying traffic [%s] -> [%s]", src, dst)
	defer log.Printf("[debug] stop relaying traffic [%s] -> [%s]", src, dst)

	const commonMTU = 1500
	buf := make([]byte, commonMTU)
	defer dst.Close()
	for {
		_, err := io.CopyBuffer(dst, src, buf)
		if err == nil || isErrClosed(err) {
			return
		}
	}
}

func isErrClosed(err error) bool {
	return errors.Is(err, os.ErrClosed) || errors.Is(err, fs.ErrClosed) || errors.Is(err, network.ErrClosed)
}
