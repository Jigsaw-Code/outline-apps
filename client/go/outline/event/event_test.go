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

package event

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/callback"
	"github.com/stretchr/testify/require"
)

func Test_AddListener(t *testing.T) {
	originalCnt := len(listeners)
	evt := EventName("TestAddListenerEvent")
	cb := callback.New(&testListener{})
	AddListener(evt, cb)

	require.Len(t, listeners, originalCnt+1)
	require.Len(t, listeners[evt], 1)
	require.Equal(t, listeners[evt][0], cb)
}

func Test_RemoveListener(t *testing.T) {
	originalCnt := len(listeners)
	evt := EventName("TestRemoveListenerEvent")
	cb1 := callback.New(&testListener{})
	cb2 := callback.New(&testListener{})

	AddListener(evt, cb1)
	AddListener(evt, cb2)
	require.Len(t, listeners, originalCnt+1)
	require.Len(t, listeners[evt], 2)
	require.Equal(t, listeners[evt][0], cb1)
	require.Equal(t, listeners[evt][1], cb2)

	RemoveListener(evt, cb1)
	require.Len(t, listeners, originalCnt+1)
	require.Len(t, listeners[evt], 1)
	require.Equal(t, listeners[evt][0], cb2)
}

func Test_ZeroParams(t *testing.T) {
	originalCnt := len(listeners)

	l := &testListener{}
	AddListener("", callback.New(l))
	Fire("", "")
	AddListener("TestEvent_InvalidParam", -1)

	RemoveListener("", callback.New(l))
	RemoveListener("TestEvent_InvalidParam", -1)
	RemoveListener("NonExistEventName", callback.New(&testListener{}))

	Fire("", "data1")
	Fire("NonExistEventName", "data2")

	require.Len(t, listeners, originalCnt)
}

func Test_NoSubscription(t *testing.T) {
	evt := EventName("testNoSubEvent")
	l := &testListener{}
	cb := callback.New(l)

	Fire(evt, "data")
	l.requireEqual(t, 0, "") // No listener, callback should not be called

	AddListener(evt, cb)
	RemoveListener(evt, cb)
	Fire(evt, "data2")
	l.requireEqual(t, 0, "") // Listener removed, callback should not be called
}

func Test_SingleSubscription(t *testing.T) {
	evt := EventName("testSingleSubEvent")
	l := &testListener{}
	cb := callback.New(l)
	AddListener(evt, cb)

	Fire(evt, "mySingleSubData")
	l.requireEqual(t, 1, "mySingleSubData")

	Fire(evt, "mySingleSubData2")
	l.requireEqual(t, 2, "mySingleSubData2")

	RemoveListener(evt, cb)
	Fire(evt, "mySingleSubData3")
	l.requireEqual(t, 2, "mySingleSubData2")

	AddListener(evt, cb)
	Fire(evt, "mySingleSubData4")
	l.requireEqual(t, 3, "mySingleSubData4")
}

func Test_MultipleSubscriptions(t *testing.T) {
	evt := EventName("testMultiSubEvent")
	l1 := &testListener{}
	l2 := &testListener{}
	l3 := &testListener{}
	cb1 := callback.New(l1)
	cb2 := callback.New(l2)
	cb3 := callback.New(l3)

	AddListener(evt, cb1)
	AddListener(evt, cb2)
	AddListener(evt, cb3)

	Fire(evt, "data1")
	l1.requireEqual(t, 1, "data1")
	l2.requireEqual(t, 1, "data1")
	l3.requireEqual(t, 1, "data1")

	Fire(evt, "data2")
	l1.requireEqual(t, 2, "data2")
	l2.requireEqual(t, 2, "data2")
	l3.requireEqual(t, 2, "data2")

	RemoveListener(evt, cb2)
	Fire(evt, "data3")
	l1.requireEqual(t, 3, "data3")
	l2.requireEqual(t, 2, "data2") // Listener 2 removed, should not increment
	l3.requireEqual(t, 3, "data3")
}

func TestMultipleEvents(t *testing.T) {
	evt1 := EventName("testMultiEvt1")
	evt2 := EventName("testMultiEvt2")
	l1 := &testListener{}
	l2 := &testListener{}
	cb1 := callback.New(l1)
	cb2 := callback.New(l2)

	AddListener(evt1, cb1)
	AddListener(evt2, cb2)

	Fire(evt1, "data1")
	l1.requireEqual(t, 1, "data1")
	l2.requireEqual(t, 0, "")

	Fire(evt2, "data2")
	l1.requireEqual(t, 1, "data1")
	l2.requireEqual(t, 1, "data2")

	Fire(evt1, "data3")
	l1.requireEqual(t, 2, "data3")
	l2.requireEqual(t, 1, "data2")

	Fire(evt2, "data4")
	l1.requireEqual(t, 2, "data3")
	l2.requireEqual(t, 2, "data4")
}

func TestConcurrentEvents(t *testing.T) {
	const (
		numEvents         = 50
		listenersPerEvent = 20
		invokesPerEvent   = 50
	)

	originalCnt := len(listeners)
	evts := make([]EventName, numEvents)
	var wg sync.WaitGroup

	// Subscribe to events concurrently
	handlers := make([]*testListener, numEvents*listenersPerEvent)
	wg.Add(numEvents * listenersPerEvent)
	for i := 0; i < numEvents; i++ {
		evts[i] = EventName(fmt.Sprintf("testConcurrentEvent-%d", i))
		for j := 0; j < listenersPerEvent; j++ {
			go func(i, j int) {
				defer wg.Done()
				lis := &testListener{}
				AddListener(evts[i], callback.New(lis))
				handlers[i*listenersPerEvent+j] = lis
			}(i, j)
		}
	}
	wg.Wait()

	// Invoke events concurrently
	wg.Add(numEvents * invokesPerEvent)
	for i := 0; i < numEvents; i++ {
		for j := 0; j < invokesPerEvent; j++ {
			go func(i, j int) {
				defer wg.Done()
				Fire(evts[i], fmt.Sprintf("data-%d-%d", i, j))
			}(i, j)
		}
	}
	wg.Wait()

	// Verify results
	require.Len(t, listeners, originalCnt+numEvents)
	for i := 0; i < numEvents*listenersPerEvent; i++ {
		require.Equal(t, int32(invokesPerEvent), handlers[i].cnt.Load())
		require.Regexp(t, fmt.Sprintf("data-%d-\\d", i/listenersPerEvent), handlers[i].lastData.Load())
	}
}

type testListener struct {
	cnt      atomic.Int32
	lastData atomic.Value
}

func (l *testListener) OnCall(eventData string) string {
	l.cnt.Add(1)
	l.lastData.Store(eventData)
	return ""
}

func (l *testListener) requireEqual(t *testing.T, cnt int32, data string) {
	require.Equal(t, cnt, l.cnt.Load())
	if cnt == 0 {
		require.Nil(t, l.lastData.Load())
	} else {
		require.Equal(t, data, l.lastData.Load())
	}
}
