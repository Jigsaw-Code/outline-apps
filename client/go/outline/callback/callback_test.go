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

func Test_Register(t *testing.T) {
	mgr := NewManager()
	token := mgr.Register(&testCallback{})
	require.Equal(t, Token(1), token)
	require.Contains(t, mgr.callbacks, token)
	require.Equal(t, Token(2), mgr.nextCbID)
}

func Test_Unregister(t *testing.T) {
	mgr := NewManager()
	token := mgr.Register(&testCallback{})
	require.Equal(t, Token(1), token)
	require.Contains(t, mgr.callbacks, token)

	mgr.Unregister(token)
	require.NotContains(t, mgr.callbacks, token)
	require.Equal(t, Token(2), mgr.nextCbID)

	mgr.Unregister(0)
	require.NotContains(t, mgr.callbacks, token)
	require.Equal(t, Token(2), mgr.nextCbID)

	mgr.Unregister(-1)
	require.NotContains(t, mgr.callbacks, token)
	require.Equal(t, Token(2), mgr.nextCbID)

	mgr.Unregister(99999999)
	require.NotContains(t, mgr.callbacks, token)
	require.Equal(t, Token(2), mgr.nextCbID)
}

func Test_Call(t *testing.T) {
	mgr := NewManager()
	c := &testCallback{}
	token := mgr.Register(c)
	c.requireEqual(t, 0, "")

	ret := mgr.Call(token, "arg1")
	require.Equal(t, ret, "ret-arg1")
	c.requireEqual(t, 1, "arg1")

	ret = mgr.Call(-1, "arg1")
	require.Empty(t, ret)
	c.requireEqual(t, 1, "arg1") // No change

	ret = mgr.Call(token, "arg2")
	require.Equal(t, ret, "ret-arg2")
	c.requireEqual(t, 2, "arg2")

	ret = mgr.Call(99999999, "arg3")
	require.Empty(t, ret)
	c.requireEqual(t, 2, "arg2") // No change
}

func Test_ConcurrentRegister(t *testing.T) {
	const numTokens = 1000

	mgr := NewManager()
	var wg sync.WaitGroup

	tokens := make([]Token, numTokens)
	wg.Add(numTokens)
	for i := 0; i < numTokens; i++ {
		go func(i int) {
			defer wg.Done()
			tokens[i] = mgr.Register(&testCallback{})
			require.Greater(t, tokens[i], 0)
		}(i)
	}
	wg.Wait()

	require.Len(t, mgr.callbacks, numTokens)
	require.Equal(t, Token(numTokens+1), mgr.nextCbID)
	tokenSet := make(map[Token]bool)
	for _, token := range tokens {
		require.False(t, tokenSet[token], "Duplicate token found: %s", token)
		tokenSet[token] = true
		require.Contains(t, mgr.callbacks, token)
	}
}

func Test_ConcurrentCall(t *testing.T) {
	const numInvocations = 1000

	mgr := NewManager()
	c := &testCallback{}
	token := mgr.Register(c)

	var wg sync.WaitGroup
	wg.Add(numInvocations)
	for i := 0; i < numInvocations; i++ {
		go func(i int) {
			defer wg.Done()
			ret := mgr.Call(token, fmt.Sprintf("data-%d", i))
			require.Equal(t, ret, fmt.Sprintf("ret-data-%d", i))
		}(i)
	}
	wg.Wait()

	require.Equal(t, int32(numInvocations), c.cnt.Load())
	require.Regexp(t, `^data-\d+$`, c.lastData.Load())

	require.Len(t, mgr.callbacks, 1)
	require.Equal(t, Token(2), mgr.nextCbID)
}

func Test_ConcurrentUnregister(t *testing.T) {
	const (
		numTokens  = 50
		numDeletes = 1000
	)

	mgr := NewManager()
	tokens := make([]Token, numTokens)
	for i := 0; i < numTokens; i++ {
		tokens[i] = mgr.Register(&testCallback{})
	}
	require.Len(t, mgr.callbacks, numTokens)
	require.Equal(t, Token(numTokens+1), mgr.nextCbID)

	var wg sync.WaitGroup
	wg.Add(numDeletes)
	for i := 0; i < numDeletes; i++ {
		go func(i int) {
			defer wg.Done()
			mgr.Unregister(tokens[i%numTokens])
		}(i)
	}
	wg.Wait()

	require.Len(t, mgr.callbacks, 0)
	require.Equal(t, Token(numTokens+1), mgr.nextCbID)
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
