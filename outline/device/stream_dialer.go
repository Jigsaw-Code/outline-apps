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

package device

import (
	"github.com/Jigsaw-Code/outline-sdk/transport"
	"github.com/Jigsaw-Code/outline-sdk/transport/shadowsocks"
)

// newOutlineStreamDialer creates a [transport.StreamDialer] that connects to the remote proxy using `config`.
func newOutlineStreamDialer(config *transportConfig) (transport.StreamDialer, error) {
	dialer, err := shadowsocks.NewStreamDialer(&transport.TCPEndpoint{Address: config.RemoteAddress}, config.CryptoKey)
	if err != nil {
		return nil, err
	}
	if len(config.Prefix) > 0 {
		dialer.SaltGenerator = shadowsocks.NewPrefixSaltGenerator(config.Prefix)
	}
	return dialer, nil
}
