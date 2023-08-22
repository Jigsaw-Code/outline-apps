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

import (
	"io"
	"sync"
)

type Reader interface {
	io.Reader
}

type Writer interface {
	io.Writer
}

type AsyncCopyResult struct {
	wg     sync.WaitGroup
	copied int64
	err    error
}

func CopyAsync(dest Writer, source Reader) *AsyncCopyResult {
	w := &AsyncCopyResult{}
	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		buf := make([]byte, 1500)
		w.copied, w.err = io.CopyBuffer(dest, source, buf)
	}()
	return w
}

func (w *AsyncCopyResult) Wait() (int64, error) {
	w.wg.Wait()
	return w.copied, w.err
}
