// Copyright 2020 The Outline Authors
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

package main

import (
	"crypto/tls"
	"flag"
	"fmt"
	"log"
	"net"
	"os"

	"github.com/Jigsaw-Code/outline-apps/outline/tun2socks/intra/split"
)

func main() {
	flag.Usage = func() {
		fmt.Fprintf(flag.CommandLine.Output(), "Usage: %s [-sni=SNI] destination\n", os.Args[0])
		fmt.Fprintln(flag.CommandLine.Output(), "This tool attempts a TLS connection to the "+
			"destination (port 443), with and without splitting.  If the SNI is specified, it "+
			"overrides the destination, which can be an IP address.")
		flag.PrintDefaults()
	}

	sni := flag.String("sni", "", "Server name override")
	flag.Parse()
	destination := flag.Arg(0)
	if destination == "" {
		flag.Usage()
		return
	}

	addr, err := net.ResolveTCPAddr("tcp", net.JoinHostPort(destination, "443"))
	if err != nil {
		log.Fatalf("Couldn't resolve destination: %v", err)
	}

	if *sni == "" {
		*sni = destination
	}
	tlsConfig := &tls.Config{ServerName: *sni}

	log.Println("Trying direct connection")
	conn, err := net.DialTCP(addr.Network(), nil, addr)
	if err != nil {
		log.Fatalf("Could not establish a TCP connection: %v", err)
	}
	tlsConn := tls.Client(conn, tlsConfig)
	err = tlsConn.Handshake()
	if err != nil {
		log.Printf("Direct TLS handshake failed: %v", err)
	} else {
		log.Printf("Direct TLS succeeded")
	}

	log.Println("Trying split connection")
	splitConn, err := split.DialWithSplit(&net.Dialer{}, addr)
	if err != nil {
		log.Fatalf("Could not establish a splitting socket: %v", err)
	}
	tlsConn2 := tls.Client(splitConn, tlsConfig)
	err = tlsConn2.Handshake()
	if err != nil {
		log.Printf("Split TLS handshake failed: %v", err)
	} else {
		log.Printf("Split TLS succeeded")
	}
}
