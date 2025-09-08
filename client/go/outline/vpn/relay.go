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
	"io"
	"log/slog"
	"math/rand"
	"sync"
)

// GoRelayTraffic copies data from `src` to `dst` until an error occurs in a new goroutine.
// It closes `dst` and signals the provided WaitGroup when complete.
func GoRelayTraffic(dst, src io.ReadWriteCloser, wg *sync.WaitGroup) {
	wg.Go(func() {
		id := rand.Intn(1000)
		slog.Debug("relaying traffic ...", "#", id)
		n, err := io.Copy(dst, src)
		slog.Debug("relaying traffic done", "#", id, "n", n, "err", err)
		dst.Close()
	})
}
