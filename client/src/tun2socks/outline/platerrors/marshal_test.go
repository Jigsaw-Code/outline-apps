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
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNilErrorMarshal(t *testing.T) {
	jsonObj := convertToPlatformErrJSON(nil)
	require.Nil(t, jsonObj)
}

func TestGoErrorMarshal(t *testing.T) {
	tests := []struct {
		name string
		in   error
		want *platformErrJSON
	}{
		{
			name: "General",
			in:   errors.New("a test error obj"),
			want: &platformErrJSON{Code: string(GoError), Message: "a test error obj"},
		},
		{
			name: "Joined",
			in:   errors.Join(errors.New("test err 1"), errors.New("test err 2")),
			want: &platformErrJSON{Code: string(GoError), Message: "test err 1\ntest err 2"},
		},
		{
			name: "Formatted",
			in:   fmt.Errorf("out err: %w", errors.New("inner err")),
			want: &platformErrJSON{Code: string(GoError), Message: "out err: inner err"},
		},
		{
			name: "MultipleFormatted",
			in:   fmt.Errorf("lvl3 err: %w %w", errors.New("lvl2 err1"), fmt.Errorf("lvl2 err2: %w", errors.New("lvl1 err"))),
			want: &platformErrJSON{Code: string(GoError), Message: "lvl3 err: lvl2 err1 lvl2 err2: lvl1 err"},
		},
		{
			name: "WrappedPlatformError",
			in:   fmt.Errorf("should not unwrap: %w", &PlatformError{Code: "ERR_NO_UNWRAP", Message: "Don't unwrap"}),
			want: &platformErrJSON{
				Code:    string(GoError),
				Message: `should not unwrap: {"code":"ERR_NO_UNWRAP","message":"Don't unwrap"}`},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := convertToPlatformErrJSON(tc.in)
			require.NotNil(t, got)
			require.Nil(t, got.Cause)
			require.Equal(t, tc.want, got)
		})
	}
}

func TestPlatformErrorMarshal(t *testing.T) {
	tests := []struct {
		name string
		in   error
		want *platformErrJSON
	}{
		{
			name: "Single",
			in:   &PlatformError{Code: "ERR_TEST", Message: "test msg", Details: "test details"},
			want: &platformErrJSON{Code: "ERR_TEST", Message: "test msg", Details: "test details"},
		},
		{
			name: "Nested",
			in: &PlatformError{
				Code: "ERR_TEST", Message: "test msg", Details: "test details",
				Cause: &PlatformError{Code: "ERR_INNER", Message: "inner msg", Details: "inner details"}},
			want: &platformErrJSON{
				Code: "ERR_TEST", Message: "test msg", Details: "test details",
				Cause: &platformErrJSON{Code: "ERR_INNER", Message: "inner msg", Details: "inner details"}},
		},
		{
			name: "NestedGoError",
			in: &PlatformError{
				Code: "ERR_TEST", Message: "test msg", Details: "test details", Cause: errors.New("inner go err")},
			want: &platformErrJSON{
				Code: "ERR_TEST", Message: "test msg", Details: "test details",
				Cause: &platformErrJSON{Code: string(GoError), Message: "inner go err"}},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := convertToPlatformErrJSON(tc.in)
			require.NotNil(t, got)
			require.Equal(t, tc.want, got)
		})
	}
}
