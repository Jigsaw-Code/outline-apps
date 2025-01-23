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
#include <stdlib.h>  // for C.free
#include "go_plugin.h"
*/
import "C"
import (
	"fmt"
	"log/slog"
	"os"
	"unsafe"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/callback"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
)

// InvokeMethod is the unified entry point for TypeScript to invoke various Go functions.
//
// The input and output are all defined as string, but they may represent either a raw string,
// or a JSON string depending on the API call.
//
// Check the API name constants comment for more details about the input and output format.
//
//export InvokeMethod
func InvokeMethod(method *C.char, input *C.char) C.InvokeMethodResult {
	result := outline.InvokeMethod(C.GoString(method), C.GoString(input))
	return C.InvokeMethodResult{
		Output:    newCGoString(result.Value),
		ErrorJson: marshalCGoErrorJson(result.Error),
	}
}

// cgoCallback implements the [callback.Callback] interface and bridges the Go callback
// to a C function pointer.
type cgoCallback struct {
	ptr C.CallbackFuncPtr
}

var _ callback.Callback = (*cgoCallback)(nil)

// OnCall forwards the data to the C callback function pointer.
func (ccb *cgoCallback) OnCall(data string) {
	C.InvokeCallback(ccb.ptr, newCGoString(data))
}

// NewCallback registers a new callback function and returns a [callback.Token] string.
//
// The caller can delete the callback by calling [DeleteCallback] with the returned token.
//
//export NewCallback
func NewCallback(cb C.CallbackFuncPtr) C.InvokeMethodResult {
	token := callback.New(&cgoCallback{cb})
	return C.InvokeMethodResult{Output: newCGoString(string(token))}
}

// DeleteCallback deletes the callback identified by the token returned by [NewCallback].
//
//export DeleteCallback
func DeleteCallback(token *C.char) {
	callback.Delete(callback.Token(C.GoString(token)))
}

// newCGoString allocates memory for a C string based on the given Go string.
// It should be paired with [FreeCGoString] to avoid memory leaks.
func newCGoString(s string) *C.char {
	if s == "" {
		return nil
	}
	res := C.CString(s)
	slog.Debug("malloc CGoString", "addr", res)
	return res
}

// FreeCGoString releases the memory allocated by newCGoString.
// It also accepts null.
//
//export FreeCGoString
func FreeCGoString(s *C.char) {
	if s != nil {
		slog.Debug("free CGoString", "addr", s)
		C.free(unsafe.Pointer(s))
	}
}

// marshalCGoErrorJson marshals a PlatformError to a C style JSON string.
// It always succeeds with a non-empty string if e is not nil.
func marshalCGoErrorJson(e *platerrors.PlatformError) *C.char {
	if e == nil {
		return nil
	}
	json, err := platerrors.MarshalJSONString(e)
	if err != nil {
		return newCGoString(fmt.Sprintf("%s, failed to retrieve details due to: %s", e.Code, err.Error()))
	}
	return newCGoString(json)
}

// init initializes the backend module.
// It sets up a default logger based on the OUTLINE_DEBUG environment variable.
func init() {
	opts := slog.HandlerOptions{Level: slog.LevelInfo}

	dbg := os.Getenv("OUTLINE_DEBUG")
	if dbg != "" && dbg != "false" && dbg != "0" {
		opts.Level = slog.LevelDebug
	}

	logger := slog.New(slog.NewTextHandler(os.Stderr, &opts))
	slog.SetDefault(logger)
}
