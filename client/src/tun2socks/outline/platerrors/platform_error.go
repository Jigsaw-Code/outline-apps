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

import (
	"encoding/json"
	"fmt"
)

// ErrorCode can be used to identify the specific type of a [PlatformError].
// All possible ErrorCodes are defined as constants in this package.
// You can reliably use these values in TypeScript to check for specific errors.
type ErrorCode string

const (
	// ErrorCodeGoError represents a general error in Go that is not a [PlatformError].
	// It is typically the last error in the chain of the causes in a [PlatformError].
	// This error code is for internal use only. You should not use it to create a [PlatformError]
	// in your Go code.
	ErrorCodeGoError ErrorCode = "ERR_GOLANG_ERROR"

	// ErrorCodeGoInvalidLogic indicates a development mistake that should be identified and
	// corrected during the development process. It should not be expected to occur in production.
	ErrorCodeGoInvalidLogic ErrorCode = "ERR_GOLANG_INVALID_LOGIC"
)

// PlatformError can be used to communicate error details from Go to TypeScript.
// It contains details of errors that originate from the native network code.
//
// The error might be caused by another PlatformError or a general Go error.
// A general Go error will be converted to a JSON of [ErrorCodeGoError] with the
// corresponding error message; and no more wrapped errors will be parsed.
//
// Behind the scenes, the error's JSON string can be accessed by Java's Exception.getMessage()
// and Apple's NSError.localizedDescription through gomobile.
// It can also be written to stderr for Electron apps or included in responses from a REST API.
type PlatformError struct {
	Code             ErrorCode
	Message, Details string
	Cause            error
}

var _ error = (*PlatformError)(nil)

// Error returns a JSON string containing the error details and all its underlying causes,
// until it finds a cause that is not a [PlatformError].
// The resulting JSON can be used to reconstruct the error in TypeScript.
func (e *PlatformError) Error() string {
	if e == nil {
		return formatInvalidLogicErrJSON("nil error", "")
	}
	if e.Code == "" {
		return formatInvalidLogicErrJSON("empty error code", "")
	}
	errJson, err := json.Marshal(convertToPlatformErrJSON(e))
	if err != nil {
		return formatInvalidLogicErrJSON("JSON marshal failure", err.Error())
	}
	return string(errJson)
}

// Unwrap returns the cause of this [PlatformError].
func (e *PlatformError) Unwrap() error {
	return e.Cause
}

// formatInvalidLogicErrJSON creates a JSON string with ErrorCodeGoInvalidLogic, the msg
// and the details. Please note that msg and details should not contain double quotes.
// The returned JSON string is compatible with the JSON returned by [PlatformError].Error().
func formatInvalidLogicErrJSON(msg, details string) string {
	return fmt.Sprintf(
		`{"code":"%s","message":"%s","details":"%s"}`,
		ErrorCodeGoInvalidLogic, msg, details)
}
