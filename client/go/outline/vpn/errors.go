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

package vpn

import (
	"log/slog"

	perrs "github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
)

func errCancelled(cause error) error {
	slog.Warn("operation was cancelled", "cause", cause)
	return perrs.PlatformError{
		Code:  perrs.OperationCanceled,
		Cause: perrs.ToPlatformError(cause),
	}
}
