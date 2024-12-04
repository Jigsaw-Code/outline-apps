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

package outline

import (
	"fmt"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
)

// API name constants
const (
	// FetchResource fetches a resource located at a given URL.
	//  - Input: the URL string of the resource to fetch
	//  - Output: the content in raw string of the fetched resource
	MethodFetchResource = "FetchResource"
)

// InvokeMethodResult represents the result of an InvokeMethod call.
//
// We use a struct instead of a tuple to preserve a strongly typed error that gobind recognizes.
type InvokeMethodResult struct {
	Value string
	Error *platerrors.PlatformError
}

// InvokeMethod calls a method by name.
func InvokeMethod(method string, input string) *InvokeMethodResult {
	switch method {
	case MethodFetchResource:
		url := input
		content, err := fetchResource(url)
		return &InvokeMethodResult{
			Value: content,
			Error: platerrors.ToPlatformError(err),
		}

	default:
		return &InvokeMethodResult{Error: &platerrors.PlatformError{
			Code:    platerrors.InternalError,
			Message: fmt.Sprintf("unsupported Go method: %s", method),
		}}
	}
}
