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

package main

// #include <stdlib.h>
import "C"
import (
	"log/slog"
	"unsafe"
)

// NewCGoString allocates memory for a C string based on the given Go string.
// It should be paired with [FreeCGoString] to avoid memory leaks.
func NewCGoString(s string) *C.char {
	res := C.CString(s)
	slog.Debug("malloc CGoString", "addr", res)
	return res
}

// FreeCGoString releases the memory allocated by NewCGoString.
// It also accepts null.
//
//export FreeCGoString
func FreeCGoString(s *C.char) {
	slog.Debug("free CGoString", "addr", s)
	C.free(unsafe.Pointer(s))
}
