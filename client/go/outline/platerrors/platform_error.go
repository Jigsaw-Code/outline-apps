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
	"errors"
	"fmt"
	"strings"
)

// ErrorDetails represents a structured technical details type in a [PlatformError].
type ErrorDetails = map[string]interface{}

// PlatformError represents an error that originate from the native network code.
// It can be serialized to JSON and shared between Go and TypeScript.
type PlatformError struct {
	Code    ErrorCode      `json:"code"`
	Message string         `json:"message"`
	Details ErrorDetails   `json:"details,omitempty"`
	Cause   *PlatformError `json:"cause,omitempty"`
}

var _ error = PlatformError{}

// NewPlatformError creates a new [PlatformError] from the error code and message.
//
// This function is primarily intended for use by Java or Swift code.
// For Go code, it is recommended to construct the [PlatformError] struct directly.
func NewPlatformError(code ErrorCode, message string) *PlatformError {
	return &PlatformError{
		Code:    code,
		Message: message,
	}
}

// ToPlatformError converts an [error] into a [PlatformError].
// If the provided err is already a [PlatformError], it is returned as is.
// Otherwise, the err is wrapped into a new [PlatformError] of [InternalError].
// It returns nil if err is nil.
func ToPlatformError(err error) *PlatformError {
	if err == nil {
		return nil
	}
	if pe, ok := err.(PlatformError); ok {
		pe.normalize()
		return &pe
	}
	if pe, ok := err.(*PlatformError); ok {
		if pe == nil {
			return nil
		}
		pe.normalize()
		return pe
	}
	return &PlatformError{Code: InternalError, Message: err.Error()}
}

// Error returns a JSON string containing the error details and all its underlying causes,
// until it finds a cause that is not a [PlatformError].
// The resulting JSON can be used to reconstruct the error in TypeScript.
func (e PlatformError) Error() string {
	e.normalize()
	msg := fmt.Sprintf("(%v) %v", e.Code, e.Message)
	if e.Cause != nil {
		msg += fmt.Sprintf(": %v", e.Cause)
	}
	return msg
}

// Unwrap returns the cause of this [PlatformError].
func (e PlatformError) Unwrap() error {
	// Make sure we return a nil value, not an interface value with type `*PlatformError` pointing to nil.
	// Otherwise nil equality fails and recursive unwrapping panics.
	if e.Cause == nil {
		return nil
	}
	return e.Cause
}

// MarshalJSONString returns a JSON string containing the [PlatformError] details
// and all its underlying causes.
// The resulting JSON can be used to reconstruct the error in TypeScript.
func MarshalJSONString(e *PlatformError) (string, error) {
	if e == nil {
		return "", errors.New("a non-nil PlatformError is required")
	}
	e.normalize()
	jsonBytes, err := json.Marshal(e)
	return string(jsonBytes), err
}

// normalize ensures that all fields in the [PlatformError] e are valid.
// It sets a default value if e.Code is empty.
func (e *PlatformError) normalize() {
	if strings.TrimSpace(string(e.Code)) == "" {
		e.Code = InternalError
	}
}
