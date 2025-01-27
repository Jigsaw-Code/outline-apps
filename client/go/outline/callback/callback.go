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

// Package callback provides a thread-safe mechanism for managing and invoking callbacks.
package callback

import (
	"log/slog"
	"sync"
)

// Token can be used to uniquely identify a registered callback.
type Token int

// Callback is an interface that can be implemented to receive callbacks.
//
// It accepts an input and returns an output, allowing communication back to the caller.
type Callback interface {
	OnCall(data string) string
}

var (
	mu        sync.RWMutex
	callbacks       = make(map[Token]Callback)
	nextCbID  Token = 1
)

// New registers a new callback and returns a unique callback token.
func New(c Callback) Token {
	mu.Lock()
	defer mu.Unlock()

	token := nextCbID
	nextCbID++
	callbacks[token] = c
	slog.Debug("callback created", "token", token)
	return token
}

// Delete removes a callback identified by the token.
//
// Calling this function is safe even if the callback has not been registered.
func Delete(token Token) {
	mu.Lock()
	defer mu.Unlock()

	delete(callbacks, token)
	slog.Debug("callback deleted", "token", token)
}

// Call executes a callback identified by the token.
//
// It passes the data string to the [Callback].OnCall and returns the string returned by OnCall.
//
// Calling this function is safe even if the callback has not been registered.
func Call(token Token, data string) string {
	mu.RLock()
	defer mu.RUnlock()

	cb, ok := callbacks[token]
	if !ok {
		slog.Warn("callback not yet created", "token", token)
		return ""
	}
	slog.Debug("invoking callback", "token", token, "data", data)
	return cb.OnCall(data)
}
