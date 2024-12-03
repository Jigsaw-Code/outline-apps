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
	"log/slog"

	perrs "github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
)

const (
	ioLogPfx = "[IO] "
	nlLogPfx = "[NetLink] "
	nmLogPfx = "[NetworkManager] "
)

func errSetupVPN(pfx, msg string, cause error, params ...any) *perrs.PlatformError {
	return errPlatError(perrs.SetupSystemVPNFailed, pfx+msg, cause, params...)
}

func errCloseVPN(pfx, msg string, cause error, params ...any) *perrs.PlatformError {
	return errPlatError(perrs.DisconnectSystemVPNFailed, pfx+msg, cause, params...)
}

func errPlatError(code perrs.ErrorCode, msg string, cause error, params ...any) *perrs.PlatformError {
	logParams := append(params, "err", cause)
	slog.Error(msg, logParams...)

	details := perrs.ErrorDetails{}
	for i := 1; i < len(params); i += 2 {
		if key, ok := params[i-1].(string); ok {
			details[key] = params[i]
		}
	}
	return &perrs.PlatformError{
		Code:    code,
		Message: msg,
		Details: details,
		Cause:   perrs.ToPlatformError(cause),
	}
}
