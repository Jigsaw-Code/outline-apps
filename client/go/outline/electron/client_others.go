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

//go:build !windows

package main

import "github.com/Jigsaw-Code/outline-apps/client/go/outline"

func newOutlineClient(transportConfig string, adapterIp string, adapterIndex int) (*outline.Client, error) {
	result := outline.NewClient(transportConfig)
	if result.Error == nil {
		// nil *PlatformError is not nil error, need to guard here
		return result.Client, nil
	}
	return nil, result.Error
}
