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

package configyaml

import (
	"testing"

	"github.com/stretchr/testify/require"
)

type TestStruct struct {
	Field1 string
	Field2 int
}

func TestMapToAny_Empty(t *testing.T) {
	var s TestStruct
	require.NoError(t, MapToAny(map[string]any{}, &s))
	require.Zero(t, s)
}

func TestMapToAny_Fields(t *testing.T) {
	var s TestStruct
	require.NoError(t, MapToAny(map[string]any{
		"field1": "value1",
	}, &s))
	require.Equal(t, TestStruct{Field1: "value1"}, s)

	s = TestStruct{}
	require.NoError(t, MapToAny(map[string]any{
		"field2": 2,
	}, &s))
	require.Equal(t, TestStruct{Field2: 2}, s)

	s = TestStruct{}
	require.NoError(t, MapToAny(map[string]any{
		"field1": "value1",
		"field2": 2,
	}, &s))
	require.Equal(t, TestStruct{Field1: "value1", Field2: 2}, s)
}

func TestMapToAny_InvalidType(t *testing.T) {
	var s TestStruct
	require.Error(t, MapToAny(map[string]any{
		"field2": "should be int, not string",
	}, &s))
}

func TestMapToAny_CoercesIntToString(t *testing.T) {
	var s TestStruct
	// Not sure this is desirable, but it's how the library works.
	// This test is intended to document the behavior.
	require.NoError(t, MapToAny(map[string]any{
		"field1": 10,
	}, &s))
	require.Equal(t, TestStruct{Field1: "10"}, s)
}

func TestMapToAny_UnknownField(t *testing.T) {
	var s TestStruct
	require.Error(t, MapToAny(map[string]any{
		"field3": "value3",
	}, &s))
}
