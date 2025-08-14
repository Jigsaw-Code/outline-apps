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

//go:build !linux

package outline

import (
	"errors"
)

type vpnAPI struct{}

func getSingletonVPNAPI() *vpnAPI {
	return nil
}

func (api *vpnAPI) Establish(configStr string) (err error) {
	return errors.ErrUnsupported
}

func (api *vpnAPI) Close() error {
	return errors.ErrUnsupported
}

func setVPNStateChangeListener(_ string) error { return errors.ErrUnsupported }
