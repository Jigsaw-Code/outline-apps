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

package backend

import "github.com/Jigsaw-Code/outline-apps/outline/device"

// ProxyTunnel is an interface that will be exported by gomobile, and be used by Outline Client.
type ProxyTunnel struct {
	*device.OutlineDevice
}

func NewProxyTunnel(configJSON string) (*ProxyTunnel, error) {
	d, err := device.NewOutlineDevice(configJSON)
	if err != nil {
		return nil, err
	}
	return &ProxyTunnel{d}, nil
}
