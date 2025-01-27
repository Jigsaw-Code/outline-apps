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

// Package event provides a thread-safe mechanism for managing and triggering events.
package event

import (
	"log/slog"
	"slices"
	"sync"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/callback"
)

// EventName is a type alias for string that represents the name of an event.
// Using a dedicated type improves type safety when working with event names.
type EventName string

var (
	mu        sync.RWMutex
	listeners = make(map[EventName][]callback.Token)
)

// AddListener adds a [callback.Callback] to a given [EventName].
//
// The provided callback will be called when the event is invoked, along with the event data.
func AddListener(evt EventName, cb callback.Token) {
	if evt == "" || cb <= 0 {
		slog.Warn("ignores empty event or invalid callback token")
		return
	}
	mu.Lock()
	defer mu.Unlock()

	listeners[evt] = append(listeners[evt], cb)
	slog.Debug("successfully subscribed to event", "event", evt, "callback", cb)
}

// RemoveListener removes a [callback.Callback] from the specified [EventName].
//
// Calling this function is safe even if the event has not been registered.
func RemoveListener(evt EventName, cb callback.Token) {
	mu.Lock()
	defer mu.Unlock()

	if cbs, ok := listeners[evt]; ok {
		listeners[evt] = slices.DeleteFunc(cbs, func(t callback.Token) bool { return t == cb })
	}
	slog.Debug("successfully ubsubscribed from event", "event", evt, "callback", cb)
}

// Fire triggers the specified [EventName], invoking all associated callbacks with the given data.
//
// The event data string must contain at least a sender ID and the event details.
// This allows listeners to identify who triggered the event.
//
// Calling this function is safe even if the event has not been registered.
func Fire(evt EventName, data string) {
	mu.RLock()
	defer mu.RUnlock()

	slog.Debug("firing event", "event", evt, "data", data)
	for _, cb := range listeners[evt] {
		callback.Call(cb, data)
	}
}
