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

//go:build maccatalyst

package useragent

// Fixes GOOS for when using maccatalyst because it's set to "ios".
// See https://github.com/golang/mobile/blob/f12310a0cfd915e168e0cced7198eb3cd73aba76/cmd/gomobile/env.go#L73
const fixedGOOS = "darwin"
