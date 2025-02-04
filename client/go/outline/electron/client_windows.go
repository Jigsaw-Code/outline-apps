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
	"log/slog"
	"net"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline"
	"github.com/Jigsaw-Code/outline-sdk/transport"
	"golang.org/x/sys/windows"
)

const (
	findNetInterfaceIP   = "1.1.1.1"
	findNetInterfacePort = 53
)

func newOutlineClient(transportConfig string) (*outline.Client, error) {
	nicIdx := findActiveNetInterface()
	tcp := newNetInterfaceBoundTCPDialer(nicIdx)
	udp := newNetInterfaceBoundUDPDialer(nicIdx)
	return outline.NewClientWithBaseDialers(transportConfig, tcp, udp)
}

func newNetInterfaceBoundTCPDialer(nicIdx uint32) transport.StreamDialer {
	return &transport.TCPDialer{Dialer: net.Dialer{KeepAlive: -1}}
}

func newNetInterfaceBoundUDPDialer(nicIdx uint32) transport.PacketDialer {
	return &transport.UDPDialer{}
}

func findActiveNetInterface() uint32 {
	addr := &windows.SockaddrInet4{
		Addr: [4]byte{8, 8, 8, 8},
		Port: findNetInterfacePort,
	}
	var idx uint32
	err := windows.GetBestInterfaceEx(addr, &idx)
	slog.Info("GetBestInterfaceEx:", "addr", addr, "idx", idx, "err", err)
	return idx
}
