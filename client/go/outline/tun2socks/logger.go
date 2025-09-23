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

package tun2socks

import (
	"io"
	"log/slog"
)

// Shared log levels between Go and the native code.
const (
	LogLevelDebug = int(slog.LevelDebug)
	LogLevelInfo  = int(slog.LevelInfo)
	LogLevelWarn  = int(slog.LevelWarn)
	LogLevelError = int(slog.LevelError)
)

// LogWriter is an interface that the native code must implement.
type LogWriter interface {
	io.Writer
}

func SetLogger(w LogWriter, minLevel int) {
	opts := &slog.HandlerOptions{
		Level: slog.Level(minLevel),
		ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
			if a.Key == slog.TimeKey {
				return slog.Attr{}
			}
			return a
		},
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(w, opts)))
}
