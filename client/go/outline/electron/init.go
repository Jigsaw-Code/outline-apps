// Copyright 2024 The Outline Authors
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

package main

import (
	"log/slog"
	"os"
)

// init initializes the backend module.
// It sets up a default logger based on the OUTLINE_DEBUG environment variable.
func init() {
	opts := slog.HandlerOptions{Level: slog.LevelInfo}

	dbg := os.Getenv("OUTLINE_DEBUG")
	if dbg != "" && dbg != "false" {
		dbg = "true"
		opts.Level = slog.LevelDebug
	} else {
		dbg = "false"
	}

	logger := slog.New(slog.NewTextHandler(os.Stderr, &opts))
	slog.SetDefault(logger)

	slog.Info("Backend module initialized", "debug", dbg)
}
