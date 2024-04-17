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
	"os"

	"github.com/eycorsican/go-tun2socks/common/log"
	_ "github.com/eycorsican/go-tun2socks/common/log/simple" // Import simple log for the side effect of making logs printable.
)

const vpnMtu = 1500

// ProcessInputPackets reads packets from a TUN device `tun` and writes them to `tunnel`.
func ProcessInputPackets(tunnel Tunnel, tun *os.File) {
	buffer := make([]byte, vpnMtu)
	for tunnel.IsConnected() {
		len, err := tun.Read(buffer)
		if err != nil {
			log.Warnf("Failed to read packet from TUN: %v", err)
			continue
		}
		if len == 0 {
			log.Infof("Read EOF from TUN")
			continue
		}
		tunnel.Write(buffer)
	}
}
