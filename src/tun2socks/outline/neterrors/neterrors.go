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

// Package errors contains a model for errors shared with the Outline Client application.
//
// TODO(fortuna): Revamp error handling. This is an inverted dependency. The Go code should
// provide its own standalone API, leaving translations to the consumer.
package neterrors

type Error int

func (e Error) Number() int {
	return int(e)
}

// Outline error codes. Must be kept in sync with definitions in https://github.com/Jigsaw-Code/outline-client/blob/master/src/www/model/errors.ts
const (
	NoError                     Error = 0
	Unexpected                  Error = 1
	NoVPNPermissions            Error = 2 // Unused
	AuthenticationFailure       Error = 3
	UDPConnectivity             Error = 4
	Unreachable                 Error = 5
	VpnStartFailure             Error = 6  // Unused
	IllegalConfiguration        Error = 7  // Electron only
	ShadowsocksStartFailure     Error = 8  // Unused
	ConfigureSystemProxyFailure Error = 9  // Unused
	NoAdminPermissions          Error = 10 // Unused
	UnsupportedRoutingTable     Error = 11 // Unused
	SystemMisconfigured         Error = 12 // Electron only
)
