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

package tunnel

import (
	"errors"
	"io"

	"github.com/eycorsican/go-tun2socks/core"
)

// Tunnel represents a session on a TUN device.
type Tunnel interface {
	// IsConnected is true if Disconnect has not been called.
	IsConnected() bool
	// Disconnect closes the underlying resources. Subsequent Write calls will fail.
	Disconnect()
	// Write writes input data to the TUN interface.
	Write(data []byte) (int, error)
}

type tunnel struct {
	tunWriter   io.WriteCloser
	lwipStack   core.LWIPStack
	isConnected bool
}

func (t *tunnel) IsConnected() bool {
	return t.isConnected
}

func (t *tunnel) Disconnect() {
	if !t.isConnected {
		return
	}
	t.isConnected = false
	t.lwipStack.Close()
	t.tunWriter.Close()
}

func (t *tunnel) Write(data []byte) (int, error) {
	if !t.isConnected {
		return 0, errors.New("Failed to write, network stack closed")
	}
	return t.lwipStack.Write(data)
}

func NewTunnel(tunWriter io.WriteCloser, lwipStack core.LWIPStack) Tunnel {
	return &tunnel{tunWriter, lwipStack, true}
}
