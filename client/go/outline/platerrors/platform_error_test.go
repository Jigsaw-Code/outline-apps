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
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPlatformErrorJSONOutput(t *testing.T) {
	tests := []struct {
		name string
		in   PlatformError
		want string
	}{
		{
			name: "Simple",
			in:   PlatformError{Code: "ERR_SIMPLE", Message: "simple err"},
			want: `{"code":"ERR_SIMPLE","message":"simple err"}`,
		},
		{
			name: "EmptyDetails",
			in:   PlatformError{Code: "ERR_EMPTY_DETAILS", Message: "empty details", Details: ErrorDetails{}},
			want: `{"code":"ERR_EMPTY_DETAILS","message":"empty details"}`,
		},
		{
			name: "Full",
			in:   PlatformError{Code: "ERR_FULL", Message: "full err", Details: ErrorDetails{"full": "details"}},
			want: `{"code":"ERR_FULL","message":"full err","details":{"full":"details"}}`,
		},
		{
			name: "Nested",
			in: PlatformError{
				Code:    "ERR_LVL2",
				Message: "msg lvl2",
				Cause: &PlatformError{
					Code:    "ERR_LVL1",
					Message: "msg lvl1",
					Details: ErrorDetails{"details": "here"},
					Cause:   ToPlatformError(errors.New("go err lvl0")),
				},
			},
			want: `{"code":"ERR_LVL2","message":"msg lvl2",` +
				`"cause":{"code":"ERR_LVL1","message":"msg lvl1","details":{"details":"here"},` +
				`"cause":{"code":"ERR_INTERNAL_ERROR","message":"go err lvl0"}}}`,
		},
		{
			name: "Details",
			in: PlatformError{Code: "ERR_DETAILS", Message: "test details types", Details: ErrorDetails{
				"arr":     []interface{}{246, "lol", false},
				"boolean": true,
				"int":     1357,
				"nil":     nil,
				"obj":     map[string]interface{}{"3": 14, "pi": "day", "true": false},
				"str":     "is good",
			}},
			want: `{"code":"ERR_DETAILS","message":"test details types","details":{` +
				`"arr":[246,"lol",false],` +
				`"boolean":true,` +
				`"int":1357,` +
				`"nil":null,` +
				`"obj":{"3":14,"pi":"day","true":false},` +
				`"str":"is good"` +
				`}}`,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := MarshalJSONString(&tc.in)
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}
}

func TestPlatformErrorWrapsCause(t *testing.T) {
	err := PlatformError{Code: "ERR_WRAP", Message: "should wrap"}
	require.Nil(t, err.Unwrap())

	inner := PlatformError{Code: "ERR_INNER", Message: "my inner error"}
	err.Cause = ToPlatformError(inner)
	require.Equal(t, &inner, err.Unwrap())

	err.Cause = ToPlatformError(&inner)
	require.Equal(t, &inner, err.Unwrap())

	inner2 := PlatformError{Code: "ERR_INNER2"}
	var innerErr2 error = inner2
	err.Cause = ToPlatformError(innerErr2)
	require.Equal(t, &inner2, err.Unwrap())

	var innerErr3 error = &inner2
	err.Cause = ToPlatformError(innerErr3)
	require.Equal(t, &inner2, err.Unwrap())

	var nilErr error = (*PlatformError)(nil)
	err.Cause = ToPlatformError(nilErr)
	require.Nil(t, err.Unwrap())
}

func TestPlatformErrorUnrapsNil(t *testing.T) {
	err := PlatformError{Code: InternalError, Message: "some message"}
	require.Equal(t, nil, err.Unwrap())
}

func TestEmptyErrorCode(t *testing.T) {
	pe := &PlatformError{}

	got := pe.Error()
	want := "(ERR_INTERNAL_ERROR) "
	require.Equal(t, want, got)

	got, err := MarshalJSONString(pe)
	require.NoError(t, err)
	want = `{"code":"ERR_INTERNAL_ERROR","message":""}`
	require.Equal(t, want, got)

	pe = ToPlatformError(pe)
	require.Equal(t, InternalError, pe.Code)
}

// Test the output when json.Marshal returns an error, which should not happen.
// But we want to make sure if it happens the returned JSON is well-formatted.
func TestJSONMarshalError(t *testing.T) {
	e := &PlatformError{Code: "ERR_\\CYCLE\\_JSON", Message: "Cycled \n\"JSON\""}
	e.Cause = e

	got, err := MarshalJSONString(e)
	require.Error(t, err)
	require.Empty(t, got)
}
