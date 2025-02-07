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

package vpn

import (
	"fmt"
	"time"
)

// TODO: NetworkManager is async, use signals instead of retries in the future
const (
	nmRetryCount = 20
	nmRetryDelay = 50 * time.Millisecond
)

func nmCallWithRetry(doWork func() error) (err error) {
	for retries := nmRetryCount; retries > 0; retries-- {
		if err = doWork(); err == nil {
			return nil
		}
		time.Sleep(nmRetryDelay)
	}
	return fmt.Errorf("exceeds maximum retry attempts: %w", err)
}
