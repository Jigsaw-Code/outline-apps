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

package tun2socks

import (
	"net"
	"testing"
	"time"

	"github.com/eycorsican/go-tun2socks/core"
	"github.com/stretchr/testify/require"
)

type nilPacketConn struct {
	net.PacketConn
}

func TestUDPHandler_Panic(t *testing.T) {
	h := &udpHandler{
		listener: nil,
		timeout:  5 * time.Minute,
		conns: map[core.UDPConn]net.PacketConn{
			nil: &nilPacketConn{},
		},
	}
	err := h.ReceiveTo(nil, []byte{0}, &net.UDPAddr{})
	require.ErrorContains(t, err, "nil pointer")
}
