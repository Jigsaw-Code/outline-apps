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

	"github.com/stretchr/testify/require"
)

func Test_InvalidParams(t *testing.T) {
	cntLst := len(listeners)

	l := &testListener{}
	Subscribe("", l, "")
	Raise("", "")
	Subscribe("TestEvent", nil, "")
	Unsubscribe("")

	require.Equal(t, cntLst, len(listeners))
}

func Test_UnsubscribeNonExistEvent(t *testing.T) {
	Unsubscribe("")
	Unsubscribe("NonExistEventName")
}

func Test_InvokeNonExistEvent(t *testing.T) {
	Raise("", "")
	Raise("NonExistEventName", "Param")
}

func TestNoSubscription(t *testing.T) {
	evt := EventName("testNoSubEvent")
	l := &testListener{}

	Raise(evt, "data")
	l.requireEqual(t, 0, "", "")

	Subscribe(evt, l, "param")
	Unsubscribe(evt)
	Raise(evt, "data2")
	l.requireEqual(t, 0, "", "")
}

func TestSingleSubscription(t *testing.T) {
	evt := EventName("testSingleSubEvent")
	l := &testListener{}
	Subscribe(evt, l, "mySingleSubParam")

	Raise(evt, "mySingleSubData")
	l.requireEqual(t, 1, "mySingleSubData", "mySingleSubParam")

	Raise(evt, "mySingleSubData2")
	l.requireEqual(t, 2, "mySingleSubData2", "mySingleSubParam")

	Unsubscribe(evt)
	Raise(evt, "mySingleSubData3")
	l.requireEqual(t, 2, "mySingleSubData2", "mySingleSubParam")

	Subscribe(evt, l, "")
	Raise(evt, "mySingleSubData4")
	l.requireEqual(t, 3, "mySingleSubData4", "")
}

func TestOverwriteSubscription(t *testing.T) {
	evt := EventName("testOverwriteSubEvent")
	l1 := &testListener{}
	l2 := &testListener{}

	Subscribe(evt, l1, "param1")
	Raise(evt, "data1")
	l1.requireEqual(t, 1, "data1", "param1")
	l2.requireEqual(t, 0, "", "")

	Subscribe(evt, l2, "param2")
	Raise(evt, "data2")
	l1.requireEqual(t, 1, "data1", "param1")
	l2.requireEqual(t, 1, "data2", "param2")
}

func TestMultipleEvents(t *testing.T) {
	evt1 := EventName("testMultiEvt1")
	evt2 := EventName("testMultiEvt2")
	l1 := &testListener{}
	l2 := &testListener{}

	Subscribe(evt1, l1, "p1")
	Subscribe(evt2, l2, "p2")

	Raise(evt1, "d1")
	l1.requireEqual(t, 1, "d1", "p1")
	l2.requireEqual(t, 0, "", "")

	Raise(evt2, "d2")
	l1.requireEqual(t, 1, "d1", "p1")
	l2.requireEqual(t, 1, "d2", "p2")

	Raise(evt1, "d3")
	l1.requireEqual(t, 2, "d3", "p1")
	l2.requireEqual(t, 1, "d2", "p2")

	Raise(evt2, "d4")
	l1.requireEqual(t, 2, "d3", "p1")
	l2.requireEqual(t, 2, "d4", "p2")
}

func TestConcurrentEvents(t *testing.T) {
	const numEvents = 50
	const invokesPerEvent = 50

	var wg sync.WaitGroup

	// Subscribe to events concurrently
	listeners := make([]*testListener, numEvents)
	wg.Add(numEvents)
	for i := 0; i < numEvents; i++ {
		go func(i int) {
			defer wg.Done()
			listeners[i] = &testListener{}
			evtName := EventName(fmt.Sprintf("testConcurrentEvent-%d", i))
			Subscribe(evtName, listeners[i], fmt.Sprintf("param-%d", i))
		}(i)
	}
	wg.Wait()

	// Invoke events concurrently
	wg.Add(numEvents * invokesPerEvent)
	for i := 0; i < numEvents; i++ {
		for j := 0; j < invokesPerEvent; j++ {
			go func(i, j int) {
				defer wg.Done()
				evtName := EventName(fmt.Sprintf("testConcurrentEvent-%d", i))
				Raise(evtName, fmt.Sprintf("data-%d-%d", i, j))
			}(i, j)
		}
	}
	wg.Wait()

	// Verify results
	for i := 0; i < numEvents; i++ {
		require.Equal(t, int32(invokesPerEvent), listeners[i].cnt.Load())
		require.Regexp(t, fmt.Sprintf("data-%d-\\d", i), listeners[i].lastData.Load())
		require.Equal(t, fmt.Sprintf("param-%d", i), listeners[i].lastParam.Load())
	}
}

type testListener struct {
	cnt                 atomic.Int32
	lastData, lastParam atomic.Value
}

func (l *testListener) Handle(eventData, param string) {
	l.cnt.Add(1)
	l.lastData.Store(eventData)
	l.lastParam.Store(param)
}

func (l *testListener) requireEqual(t *testing.T, cnt int32, data string, param string) {
	require.Equal(t, cnt, l.cnt.Load())
	if cnt == 0 {
		require.Nil(t, l.lastData.Load())
		require.Nil(t, l.lastParam.Load())
	} else {
		require.Equal(t, data, l.lastData.Load())
		require.Equal(t, param, l.lastParam.Load())
	}
}
