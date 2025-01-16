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

// Package event provides a thread-safe event system for Outline.
// It allows components to subscribe to events and be notified when they occur.
//
// This package is also designed for cross-language invocations between Go and TypeScript.
// All data structures related to an event should be designed to be compatible between both languages.
package event

import (
	"log/slog"
	"sync"
)

// EventName is a type alias for string that represents the name of an event.
// Using a dedicated type improves type safety when working with event names.
type EventName string

// Listener is the interface that must be implemented by the object that wants to subscribe to events.
type Listener interface {
	// When an event is triggered, Handle is called with the event data as well as the optional parameter
	// that was passed during [Subscribe].
	Handle(eventData, param string)
}

// listenerInfo holds the listener callback and the optional parameter provided during [Subscribe].
type listenerInfo struct {
	cb    Listener
	param string
}

var (
	mu        sync.RWMutex                       // Protects the listeners map
	listeners = make(map[EventName]listenerInfo) // A map containing all event listeners
)

// Subscribe registers a [Listener] for a given [EventName].
//
// This function overwrites any existing listeners for the specified [EventName].
//
// The provided [Listener] will be called when the event is invoked, along with the event data and the supplied param.
func Subscribe(evt EventName, cb Listener, param string) {
	if evt == "" || cb == nil {
		slog.Warn("empty event or listener is ignored")
		return
	}
	mu.Lock()
	defer mu.Unlock()

	listeners[evt] = listenerInfo{cb, param}
	slog.Debug("successfully subscribed to event", "event", evt, "param", param)
}

// Unsubscribe removes the listener for the specified [EventName].
//
// Calling this function is safe even if the event has not been registered.
func Unsubscribe(evt EventName) {
	mu.Lock()
	defer mu.Unlock()

	delete(listeners, evt)
	slog.Debug("successfully ubsubscribed from event", "event", evt)
}

// Raise triggers the specified [EventName] with the given data.
//
// This function will do nothing if no listener is registered.
func Raise(evt EventName, data string) {
	mu.RLock()
	defer mu.RUnlock()

	if l, ok := listeners[evt]; ok {
		slog.Debug("firing event", "event", evt, "data", data, "param", l.param)
		l.cb.Handle(data, l.param)
	} else {
		slog.Debug("event fired but no handlers are found", "event", evt, "data", data)
	}
}
