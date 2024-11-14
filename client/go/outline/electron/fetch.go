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
#include "platerr.h"

// FetchResourceResult represents the result of fetching a resource located at a URL.
typedef struct t_FetchResourceResult {
  // The content of the fetched resource.
  // Caller is responsible for freeing this pointer using FreeCGoString.
	const char *Content;

	// If this is not null, it represents the error encountered during fetching.
	// Caller is responsible for freeing this pointer using FreeCGoPlatformError.
	const PlatformError *Error;
} FetchResourceResult;
*/
import "C"
import "github.com/Jigsaw-Code/outline-apps/client/go/outline"

// FetchResource fetches a resource located at the given URL.
//
// The function returns a C FetchResourceResult containing the Content of the resource
// and any Error encountered during fetching.
//
// You don't need to free the memory of FetchResourceResult struct itself, as it's not a pointer.
// However, you are responsible for freeing the memory of its Content and Error fields.
//
//export FetchResource
func FetchResource(cstr *C.char) C.FetchResourceResult {
	url := C.GoString(cstr)
	result := outline.FetchResource(url)
	return C.FetchResourceResult{
		Content: NewCGoString(result.Content),
		Error:   ToCGoPlatformError(result.Error),
	}
}
