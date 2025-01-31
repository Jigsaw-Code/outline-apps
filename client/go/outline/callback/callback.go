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
//
// This token is designed to be used across language boundaries.
// For example, TypeScript code can use this token to reference a callback.
type Token int

// Handler is an interface that can be implemented to receive callbacks.
type Handler interface {
	// OnCall is called when the callback is invoked. It accepts an input string and
	// optionally returns an output string.
	OnCall(data string) string
}

// Manager manages the registration, unregistration, and invocation of callbacks.
type Manager struct {
	mu        sync.RWMutex
	callbacks map[Token]Handler
	nextCbID  Token
}

// variables defining the DefaultManager.
var (
	mgrInstance *Manager
	initMgrOnce sync.Once
)

// DefaultManager returns the shared default callback [Manager] that can be used across
// all compoenents.
func DefaultManager() *Manager {
	initMgrOnce.Do(func() {
		mgrInstance = NewManager()
	})
	return mgrInstance
}

// NewManager creates a new callback [Manager].
func NewManager() *Manager {
	return &Manager{
		callbacks: make(map[Token]Handler),
		nextCbID:  1,
	}
}

// Register registers a new callback to the [Manager].
//
// It returns a unique [Token] that can be used to unregister or invoke the callback.
func (m *Manager) Register(c Handler) Token {
	m.mu.Lock()
	defer m.mu.Unlock()

	token := m.nextCbID
	m.nextCbID++
	m.callbacks[token] = c
	slog.Debug("callback created", "token", token)
	return token
}

// Unregister removes a previously registered callback from the [Manager].
//
// It is safe to call this function with a non-registered [Token].
func (m *Manager) Unregister(token Token) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.callbacks, token)
	slog.Debug("callback deleted", "token", token)
}

// Call invokes the callback identified by the given [Token].
//
// It passes data to the [Handler]'s OnCall method and returns the result.
//
// It is safe to call this function with a non-registered [Token].
func (m *Manager) Call(token Token, data string) string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	cb, ok := m.callbacks[token]
	if !ok {
		slog.Warn("callback not yet registered", "token", token)
		return ""
	}
	slog.Debug("invoking callback", "token", token, "data", data)
	return cb.OnCall(data)
}
