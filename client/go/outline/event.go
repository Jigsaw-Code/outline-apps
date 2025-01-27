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

package outline

import (
	"encoding/json"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/callback"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/event"
	perrs "github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
)

// eventListenerJSON represents the JSON structure for adding or removing event listeners.
type eventListenerJSON struct {
	// Name is the name of the event to listen for.
	Name string `json:"name"`

	// Callback token is the token of the callback function returned from callback.NewCallback.
	Callback int `json:"callbackToken"`
}

func addEventListener(input string) error {
	listener, err := parseEventListenerInput(input)
	if err != nil {
		return err
	}
	event.AddListener(event.EventName(listener.Name), callback.Token(listener.Callback))
	return nil
}

func removeEventListener(input string) error {
	listener, err := parseEventListenerInput(input)
	if err != nil {
		return err
	}
	event.RemoveListener(event.EventName(listener.Name), callback.Token(listener.Callback))
	return nil
}

func parseEventListenerInput(input string) (*eventListenerJSON, error) {
	var listener eventListenerJSON
	if err := json.Unmarshal([]byte(input), &listener); err != nil {
		return nil, perrs.PlatformError{
			Code:    perrs.InternalError,
			Message: "invalid event listener argument",
			Cause:   perrs.ToPlatformError(err),
		}
	}
	return &listener, nil
}
