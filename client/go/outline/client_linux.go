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

package outline

import (
	"net"
	"syscall"
)

// NewClient creates a new Outline client from a configuration string.
func NewClientWithFWMark(transportConfig string, fwmark uint32) (*Client, error) {
	control := func(network, address string, c syscall.RawConn) error {
		return c.Control(func(fd uintptr) {
			syscall.SetsockoptInt(int(fd), syscall.SOL_SOCKET, syscall.SO_MARK, int(fwmark))
		})
	}

	tcp := net.Dialer{
		Control:   control,
		KeepAlive: -1,
	}

	udp := net.Dialer{
		Control: control,
	}

	return newClientWithBaseDialers(transportConfig, tcp, udp)
}
