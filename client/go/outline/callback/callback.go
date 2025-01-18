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
	"fmt"
	"log/slog"
	"sync"
)

// Token can be used to uniquely identify a registered callback.
type Token string

// Callback is an interface that can be implemented to receive callbacks.
type Callback interface {
	OnCall(data string)
}

var (
	mu        sync.RWMutex
	callbacks        = make(map[uint32]Callback)
	nextCbID  uint32 = 1
)

// New registers a new callback and returns a unique callback token.
func New(c Callback) Token {
	mu.Lock()
	defer mu.Unlock()

	id := nextCbID
	nextCbID++
	callbacks[id] = c
	slog.Debug("callback created", "id", id)
	return getTokenByID(id)
}

// Delete removes a callback identified by the token.
//
// Calling this function is safe even if the callback has not been registered.
func Delete(token Token) {
	mu.Lock()
	defer mu.Unlock()

	if id, err := getIDByToken(token); err == nil {
		delete(callbacks, id)
		slog.Debug("callback deleted", "id", id)
	} else {
		slog.Warn("invalid callback token", "err", err, "token", token)
	}
}

// Call executes a callback identified by the token.
//
// Calling this function is safe even if the callback has not been registered.
func Call(token Token, data string) {
	id, err := getIDByToken(token)
	if err != nil {
		slog.Warn("invalid callback token", "err", err, "token", token)
		return
	}

	mu.RLock()
	cb, ok := callbacks[id]
	mu.RUnlock()

	if !ok {
		slog.Warn("callback not yet created", "id", id, "token", token)
		return
	}
	slog.Debug("invoking callback", "id", id, "data", data)
	cb.OnCall(data)
}

// getTokenByID creates a string-based callback token from a number-based internal ID.
func getTokenByID(id uint32) Token {
	return Token(fmt.Sprintf("cbid-%d", id))
}

// getIDByToken parses a number-based internal ID from a string-based callback token.
func getIDByToken(token Token) (uint32, error) {
	var id uint32
	_, err := fmt.Sscanf(string(token), "cbid-%d", &id)
	return id, err
}
