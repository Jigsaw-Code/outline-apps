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
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPlatformErrorJSONOutput(t *testing.T) {
	tests := []struct {
		name string
		in   *PlatformError
		want string
	}{
		{
			name: "Simple",
			in:   &PlatformError{Code: "ERR_SIMPLE", Message: "simple err"},
			want: `{"code":"ERR_SIMPLE","message":"simple err"}`,
		},
		{
			name: "Full",
			in:   &PlatformError{Code: "ERR_FULL", Message: "full err", Details: "full details"},
			want: `{"code":"ERR_FULL","message":"full err","details":"full details"}`,
		},
		{
			name: "Nested",
			in: &PlatformError{
				Code: "ERR_LVL2", Message: "msg lvl2",
				Cause: &PlatformError{Code: "ERR_LVL1", Message: "msg lvl1", Details: "details here",
					Cause: errors.New("go err lvl0")}},
			want: `{"code":"ERR_LVL2","message":"msg lvl2",` +
				`"cause":{"code":"ERR_LVL1","message":"msg lvl1","details":"details here",` +
				`"cause":{"code":"ERR_GOLANG_ERROR","message":"go err lvl0"}}}`,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := tc.in.Error()
			require.Equal(t, tc.want, got)
		})
	}
}

func TestPlatformErrorWrapsCause(t *testing.T) {
	err := &PlatformError{Code: "ERR_WRAP", Message: "should wrap"}
	require.Nil(t, err.Unwrap())

	inner := errors.New("my inner error")
	err.Cause = inner
	require.Equal(t, inner, err.Unwrap())
}

func TestNilError(t *testing.T) {
	got := (*PlatformError)(nil).Error()
	want := `{"code":"ERR_GOLANG_INVALID_LOGIC","message":"nil error","details":""}`
	require.Equal(t, want, got)
}

func TestInvalidErrorCode(t *testing.T) {
	got := (&PlatformError{}).Error()
	want := `{"code":"ERR_GOLANG_INVALID_LOGIC","message":"empty error code","details":""}`
	require.Equal(t, want, got)
}

// Test the output when json.Marshal returns an error, which should not happen.
// But we want to make sure if it happens the returned JSON is well-formatted.
func TestJSONMarshalError(t *testing.T) {
	e := &platformErrJSON{}
	e.Cause = e
	errJson, err := json.Marshal(e)
	require.Nil(t, errJson)
	require.Error(t, err)

	got := formatInvalidLogicErrJSON("JSON marshal failure", err.Error())
	want := `{"code":"ERR_GOLANG_INVALID_LOGIC","message":"JSON marshal failure",` +
		`"details":"json: unsupported value: encountered a cycle via *platerrors.platformErrJSON"}`
	require.Equal(t, want, got)
}
