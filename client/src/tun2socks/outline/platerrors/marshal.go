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

package platerrors

// platformErrJson is the JSON representation of a [PlatformError].
type platformErrJSON struct {
	Code    string           `json:"code"`
	Message string           `json:"message"`
	Details string           `json:"details,omitempty"`
	Cause   *platformErrJSON `json:"cause,omitempty"`
}

// convertToPlatformErrJSON converts an error into a platformErrJSON.
func convertToPlatformErrJSON(e error) *platformErrJSON {
	if e == nil {
		return nil
	}

	pe, ok := e.(*PlatformError)
	if !ok {
		// We simply return a single JSON object without recursively parsing the wrapped errors,
		// as they don't provide any additional information beyond the already included error message.
		return &platformErrJSON{
			Code:    string(GoError),
			Message: e.Error(),
		}
	}
	if pe == nil {
		// A non-nil interface that contains nil value
		return nil
	}

	return &platformErrJSON{
		Code:    string(pe.Code),
		Message: pe.Message,
		Details: pe.Details,
		Cause:   convertToPlatformErrJSON(pe.Cause),
	}
}
