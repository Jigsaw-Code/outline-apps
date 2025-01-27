// Copyright 2025 The Outline Authors
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

package callback

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
)

func Test_New(t *testing.T) {
	curID := nextCbID
	token := New(&testCallback{})
	require.Equal(t, curID, token)
	require.Contains(t, callbacks, token)
	require.Equal(t, curID+1, nextCbID)
}

func Test_Delete(t *testing.T) {
	curID := nextCbID
	token := New(&testCallback{})
	require.Equal(t, curID, token)
	require.Contains(t, callbacks, token)

	Delete(token)
	require.NotContains(t, callbacks, token)
	require.Equal(t, curID+1, nextCbID)

	Delete(0)
	require.NotContains(t, callbacks, token)
	require.Equal(t, curID+1, nextCbID)

	Delete(-1)
	require.NotContains(t, callbacks, token)
	require.Equal(t, curID+1, nextCbID)

	Delete(99999999)
	require.NotContains(t, callbacks, token)
	require.Equal(t, curID+1, nextCbID)
}

func Test_Call(t *testing.T) {
	c := &testCallback{}
	token := New(c)
	c.requireEqual(t, 0, "")

	ret := Call(token, "arg1")
	require.Equal(t, ret, "ret-arg1")
	c.requireEqual(t, 1, "arg1")

	ret = Call(-1, "arg1")
	require.Empty(t, ret)
	c.requireEqual(t, 1, "arg1") // No change

	ret = Call(token, "arg2")
	require.Equal(t, ret, "ret-arg2")
	c.requireEqual(t, 2, "arg2")

	ret = Call(99999999, "arg3")
	require.Empty(t, ret)
	c.requireEqual(t, 2, "arg2") // No change
}

func Test_ConcurrentCreate(t *testing.T) {
	const numTokens = 1000

	curID := nextCbID
	originalLen := len(callbacks)
	var wg sync.WaitGroup

	tokens := make([]Token, numTokens)
	wg.Add(numTokens)
	for i := 0; i < numTokens; i++ {
		go func(i int) {
			defer wg.Done()
			tokens[i] = New(&testCallback{})
			require.Greater(t, tokens[i], 0)
		}(i)
	}
	wg.Wait()

	require.Len(t, callbacks, originalLen+numTokens)
	require.Equal(t, curID+numTokens, nextCbID)
	tokenSet := make(map[Token]bool)
	for _, token := range tokens {
		require.False(t, tokenSet[token], "Duplicate token found: %s", token)
		tokenSet[token] = true
		require.Contains(t, callbacks, token)
	}
}

func Test_ConcurrentCall(t *testing.T) {
	const numInvocations = 1000

	curID := nextCbID
	originalLen := len(callbacks)

	c := &testCallback{}
	token := New(c)

	var wg sync.WaitGroup
	wg.Add(numInvocations)
	for i := 0; i < numInvocations; i++ {
		go func(i int) {
			defer wg.Done()
			ret := Call(token, fmt.Sprintf("data-%d", i))
			require.Equal(t, ret, fmt.Sprintf("ret-data-%d", i))
		}(i)
	}
	wg.Wait()

	require.Equal(t, int32(numInvocations), c.cnt.Load())
	require.Regexp(t, `^data-\d+$`, c.lastData.Load())

	require.Len(t, callbacks, originalLen+1)
	require.Equal(t, curID+1, nextCbID)
}

func Test_ConcurrentDelete(t *testing.T) {
	const (
		numTokens  = 50
		numDeletes = 1000
	)

	curID := nextCbID
	originalLen := len(callbacks)

	tokens := make([]Token, numTokens)
	for i := 0; i < numTokens; i++ {
		tokens[i] = New(&testCallback{})
	}
	require.Len(t, callbacks, originalLen+numTokens)
	require.Equal(t, curID+numTokens, nextCbID)

	var wg sync.WaitGroup
	wg.Add(numDeletes)
	for i := 0; i < numDeletes; i++ {
		go func(i int) {
			defer wg.Done()
			Delete(tokens[i%numTokens])
		}(i)
	}
	wg.Wait()

	require.Len(t, callbacks, originalLen)
	require.Equal(t, curID+numTokens, nextCbID)
}

// testCallback is a mock implementation of callback.Callback for testing.
type testCallback struct {
	cnt      atomic.Int32
	lastData atomic.Value
}

func (tc *testCallback) OnCall(data string) string {
	tc.cnt.Add(1)
	tc.lastData.Store(data)
	return fmt.Sprintf("ret-%s", data)
}

func (tc *testCallback) requireEqual(t *testing.T, cnt int32, data string) {
	require.Equal(t, cnt, tc.cnt.Load())
	if cnt == 0 {
		require.Nil(t, tc.lastData.Load())
	} else {
		require.Equal(t, data, tc.lastData.Load())
	}
}
