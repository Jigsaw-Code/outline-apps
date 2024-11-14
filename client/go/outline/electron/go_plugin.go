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

// InvokeGoAPIResult is a struct used to pass result from Go to TypeScript boundary.
typedef struct InvokeGoAPIResult_t
{
	// A string representing the result of the Go function call.
	// This may be a raw string or a JSON string depending on the API call.
	const char *Output;

	// A string containing a JSON representation of any error that occurred during the
	// Go function call, or NULL if no error occurred.
	// This error can be parsed by the PlatformError in TypeScript.
	const char *ErrorJson;
} InvokeGoAPIResult;
*/
import "C"
import (
	"fmt"
	"log/slog"
	"os"
	"unsafe"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
)

// API name constants
const (
	// FetchResourceAPI fetches a resource located at a given URL.
	//
	//  - Input: the URL string of the resource to fetch
	//  - Output: the content in raw string of the fetched resource
	FetchResourceAPI = "FetchResource"
)

// InvokeGoAPI is the unified entry point for TypeScript to invoke various Go functions.
//
// The input and output are all defined as string, but they may represent either a raw string,
// or a JSON string depending on the API call.
//
// Check the API name constants comment for more details about the input and output format.
//
//export InvokeGoAPI
func InvokeGoAPI(api *C.char, input *C.char) C.InvokeGoAPIResult {
	apiName := C.GoString(api)
	switch apiName {

	case FetchResourceAPI:
		res := outline.FetchResource(C.GoString(input))
		return C.InvokeGoAPIResult{
			Output:    newCGoString(res.Content),
			ErrorJson: marshalCGoErrorJson(platerrors.ToPlatformError(res.Error)),
		}

	default:
		err := &platerrors.PlatformError{
			Code:    platerrors.IllegalConfig,
			Message: fmt.Sprintf("unsupported Go API: %s", apiName),
		}
		return C.InvokeGoAPIResult{ErrorJson: marshalCGoErrorJson(err)}
	}
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
	if dbg != "" && dbg != "false" {
		dbg = "true"
		opts.Level = slog.LevelDebug
	} else {
		dbg = "false"
	}

	logger := slog.New(slog.NewTextHandler(os.Stderr, &opts))
	slog.SetDefault(logger)

	slog.Info("Backend module initialized", "debug", dbg)
}
