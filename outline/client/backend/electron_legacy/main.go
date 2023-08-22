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

///go:build linux & windows

package electronlegacy

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/Jigsaw-Code/outline-apps/outline/client/backend"
	"github.com/eycorsican/go-tun2socks/tun"
)

var args struct {
	// TUN device settings
	tunAddr *string
	tunGw   *string
	tunMask *string
	tunName *string
	tunDNS  *string

	// Proxy settings
	proxyConfig *string
}

func main() {
	args.tunAddr = flag.String("tunAddr", "10.0.85.2", "TUN interface IP address")
	args.tunGw = flag.String("tunGw", "10.0.85.1", "TUN interface gateway")
	args.tunMask = flag.String("tunMask", "255.255.255.0", "TUN interface network mask; prefixlen for IPv6")
	args.tunDNS = flag.String("tunDNS", "1.1.1.1,9.9.9.9,208.67.222.222", "Comma-separated list of DNS resolvers for the TUN interface (Windows only)")
	args.tunName = flag.String("tunName", "tun0", "TUN interface name")
	args.proxyConfig = flag.String("config", "", "The Outline configuration in JSON format")
	flag.Parse()

	proxy, err := backend.NewProxyTunnel(*args.proxyConfig)
	if err != nil {
		log.Fatalf("Failed to create Outline ProxyTunnel: %v", err)
	}
	log.Println("Outline ProxyTunnel created")
	defer proxy.Close() // not necessary, but no harm

	dnsResolvers := strings.Split(*args.tunDNS, ",")
	tunDev, err := tun.OpenTunDevice(*args.tunName, *args.tunAddr, *args.tunGw, *args.tunMask, dnsResolvers, true)
	if err != nil {
		log.Fatalf("Failed to open tun device: %v", err)
	}
	log.Println("Tun device opened")
	defer tunDev.Close() // not necessary, but no harm

	defer backend.CopyAsync(tunDev, proxy).Wait()
	defer backend.CopyAsync(proxy, tunDev).Wait()

	osSignals := make(chan os.Signal, 1)
	signal.Notify(osSignals, os.Interrupt, syscall.SIGTERM, syscall.SIGHUP)
	sig := <-osSignals

	log.Printf("Received signal: %v, terminating...", sig)
	proxy.Close()
	tunDev.Close()
}
