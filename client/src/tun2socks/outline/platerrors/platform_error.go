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
	"strings"
)

// ErrorDetails represents a structured technical details type in a [PlatformError].
type ErrorDetails = map[string]interface{}

// PlatformError can be used to communicate error details from Go to TypeScript.
// It contains details of errors that originate from the native network code.
//
// The error might be caused by another PlatformError or a general Go error.
// A general Go error will be converted to a JSON of [GoError] with the
// corresponding error message; and no more wrapped errors will be parsed.
//
// Behind the scenes, the error's JSON string can be accessed by Java's Exception.getMessage()
// and Apple's NSError.localizedDescription through gomobile.
// It can also be written to stderr for Electron apps or included in responses from a REST API.
type PlatformError struct {
	Code    ErrorCode
	Message string
	Details ErrorDetails
	Cause   error
}

var _ error = (*PlatformError)(nil)

// New creates a [PlatformError] with a specific error code and message.
func New(code ErrorCode, message string) *PlatformError {
	return &PlatformError{
		Code:    code,
		Message: message,
	}
}

// NewWithDetails creates a [PlatformError] with a specific error code, message and details string.
func NewWithDetails(code ErrorCode, message string, details ErrorDetails) *PlatformError {
	return &PlatformError{
		Code:    code,
		Message: message,
		Details: details,
	}
}

// NewWithCause creates a [PlatformError] with a specific error code, message, and cause.
func NewWithCause(code ErrorCode, message string, cause error) *PlatformError {
	return &PlatformError{
		Code:    code,
		Message: message,
		Cause:   cause,
	}
}

// NewWithDetailsCause creates a [PlatformError] with an error code, message, details, and cause.
func NewWithDetailsCause(code ErrorCode, message string, details ErrorDetails, cause error) *PlatformError {
	return &PlatformError{
		Code:    code,
		Message: message,
		Details: details,
		Cause:   cause,
	}
}

// Error returns a JSON string containing the error details and all its underlying causes,
// until it finds a cause that is not a [PlatformError].
// The resulting JSON can be used to reconstruct the error in TypeScript.
func (e *PlatformError) Error() string {
	if e == nil {
		return formatInvalidLogicErrJSON("nil error")
	}
	if e.Code == "" {
		return formatInvalidLogicErrJSON("empty error code")
	}
	errJson, err := json.Marshal(convertToPlatformErrJSON(e))
	if err != nil {
		return formatInvalidLogicErrJSON("JSON marshal failure: " + err.Error())
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
func formatInvalidLogicErrJSON(msg string) string {
	rmEscapes := strings.NewReplacer("\\", "", "\"", "")
	return fmt.Sprintf(
		`{"code":"%s","message":"%s"}`,
		InvalidLogic, rmEscapes.Replace(msg))
}
