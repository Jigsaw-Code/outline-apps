// Copyright 2024 The Outline Authors
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

package vpnlinux

import (
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/Wifx/gonetworkmanager/v2"
)

func ConfigureNMConnection() *platerrors.PlatformError {
	_, err := gonetworkmanager.NewSettings()
	if err != nil {
		return &platerrors.PlatformError{
			Code:    platerrors.SetupSystemVPNFailed,
			Message: "failed to connect to NetworkManager",
			Cause:   platerrors.ToPlatformError(err),
		}
	}
	return nil
}
