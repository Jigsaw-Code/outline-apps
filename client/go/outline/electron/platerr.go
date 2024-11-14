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

/*
#include <stdlib.h>
#include "platerr.h"
*/
import "C"

import (
	"fmt"
	"log/slog"
	"unsafe"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
)

// ToCGoPlatformError allocates memory for a C PlatformError if the given Go PlatformError is not nil.
// It should be paired with [FreeCGoPlatformError] to avoid memory leaks.
func ToCGoPlatformError(e *platerrors.PlatformError) *C.PlatformError {
	if e == nil {
		return nil
	}
	json, err := platerrors.MarshalJSONString(e)
	if err != nil {
		json = fmt.Sprintf("%s, failed to retrieve details due to: %s", e.Code, err.Error())
	}

	res := (*C.PlatformError)(C.malloc(C.sizeof_PlatformError))
	slog.Debug("malloc CGoPlatformError", "addr", unsafe.Pointer(res))
	res.Code = NewCGoString(e.Code)
	res.DetailJson = NewCGoString(json)
	return res
}

// FreeCGoPlatformError releases the memory allocated by ToCGoPlatformError.
// It also accepts null.
//
//export FreeCGoPlatformError
func FreeCGoPlatformError(e *C.PlatformError) {
	slog.Debug("free CGoPlatformError", "addr", unsafe.Pointer(e))
	C.free(unsafe.Pointer(e))
}
