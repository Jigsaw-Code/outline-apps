// Copyright 2025 The Outline Authors
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
	"encoding/binary"
	"errors"
	"net"
	"syscall"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline"
	"github.com/Jigsaw-Code/outline-sdk/transport"
	"golang.org/x/sys/windows"
)

// Define missing Windows constants
const IP_UNICAST_IF = 31

func newOutlineClient(transportConfig string, adapterIP string, adapterIndex int) (*outline.Client, error) {
	if adapterIP == "" || adapterIndex < 0 {
		// Check connectivity, ignore these parameters
		result := outline.NewClient(transportConfig)
		if result.Error == nil {
			// nil *PlatformError is not nil error, need to guard here
			return result.Client, nil
		}
		return nil, result.Error
	}
	tcp := newNetInterfaceBoundTCPDialer(uint32(adapterIndex))
	udp := newNetInterfaceBoundUDPDialer(uint32(adapterIndex), adapterIP)
	return outline.NewClientWithBaseDialers(transportConfig, tcp, udp)
}

func newNetInterfaceBoundTCPDialer(nicIdx uint32) transport.StreamDialer {
	nicIdx = htonl(nicIdx)
	return &transport.TCPDialer{Dialer: net.Dialer{
		KeepAlive: -1,
		Control: func(network, address string, conn syscall.RawConn) error {
			var operr error
			err := conn.Control(func(fd uintptr) {
				operr = windows.SetsockoptInt(windows.Handle(fd), syscall.IPPROTO_IP, IP_UNICAST_IF, int(nicIdx))
			})
			return errors.Join(err, operr)
		},
	}}
}

func newNetInterfaceBoundUDPDialer(nicIdx uint32, nicIP string) transport.PacketDialer {
	nicIdx = htonl(nicIdx)
	addr := windows.SockaddrInet4{Port: 0}
	copy(addr.Addr[:], net.ParseIP(nicIP).To4())
	return &transport.UDPDialer{Dialer: net.Dialer{
		Control: func(network, address string, conn syscall.RawConn) error {
			var operr error
			err := conn.Control(func(fd uintptr) {
				err1 := windows.Bind(windows.Handle(fd), &addr)
				err2 := windows.SetsockoptInt(windows.Handle(fd), syscall.IPPROTO_IP, IP_UNICAST_IF, int(nicIdx))
				operr = errors.Join(err1, err2)
			})
			return errors.Join(err, operr)
		},
	}}
}

func htonl(v uint32) uint32 {
	bigEndianBytes := make([]byte, 4)
	binary.NativeEndian.PutUint32(bigEndianBytes, v)
	return binary.BigEndian.Uint32(bigEndianBytes)
}
