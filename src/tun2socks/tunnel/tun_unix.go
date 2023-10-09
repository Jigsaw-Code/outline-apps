// Copyright 2019 The Outline Authors
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

//go:build unix

package tunnel

import (
	"errors"
	"os"

	_ "github.com/eycorsican/go-tun2socks/common/log/simple" // Import simple log for the side effect of making logs printable.
	"golang.org/x/sys/unix"
)

// MakeTunFile returns an os.File object from a TUN file descriptor `fd`.
// The returned os.File holds a separate reference to the underlying file,
// so the file will not be closed until both `fd` and the os.File are
// separately closed.  (UNIX only.)
func MakeTunFile(fd int) (*os.File, error) {
	if fd < 0 {
		return nil, errors.New("Must provide a valid TUN file descriptor")
	}
	// Make a copy of `fd` so that os.File's finalizer doesn't close `fd`.
	newfd, err := unix.Dup(fd)
	if err != nil {
		return nil, err
	}
	file := os.NewFile(uintptr(newfd), "")
	if file == nil {
		return nil, errors.New("Failed to open TUN file descriptor")
	}
	return file, nil
}
