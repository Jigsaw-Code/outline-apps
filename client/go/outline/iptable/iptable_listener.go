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

package iptable

import (
	"context"
	"net"
	"time"

	"github.com/Jigsaw-Code/outline-sdk/transport"
)

type IPTablePacketListener struct {
	table           IPTable[transport.PacketListener]
	defaultListener transport.PacketListener
}

var _ transport.PacketListener = (*IPTablePacketListener)(nil)

func NewIPTablePacketListener(table IPTable[transport.PacketListener]) (*IPTablePacketListener, error) {
	if table == nil {
		table = NewIPTable[transport.PacketListener]()
	}
	return &IPTablePacketListener{
		table: table,
	}, nil
}

func (listener *IPTablePacketListener) SetDefault(defaultListener transport.PacketListener) {
	listener.defaultListener = defaultListener
}

func (listner *IPTablePacketListener) ListenPacket(ctx context.Context) (net.PacketConn, error) {
	return newIPTableConnection()
}

type ipTableConnection struct {
}

var _ net.PacketConn = (*ipTableConnection)(nil)

func newIPTableConnection() (*ipTableConnection, error) {
	return &ipTableConnection{}, nil
}

func (connection *ipTableConnection) ReadFrom(p []byte) (n int, addr net.Addr, err error) {

}

func (connection *ipTableConnection) WriteTo(p []byte, addr net.Addr) (n int, err error) {

}

func (connection *ipTableConnection) Close() error {

}

func (connection *ipTableConnection) LocalAddr() net.Addr {

}

func (connection *ipTableConnection) SetDeadline(t time.Time) error {

}

func (connection *ipTableConnection) SetReadDeadline(t time.Time) error {

}

func (connection *ipTableConnection) SetWriteDeadline(t time.Time) error {

}
