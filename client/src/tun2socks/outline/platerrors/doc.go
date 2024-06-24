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

/*
Package platerrors defines types, constants, and functions related to platform-specific errors
that originate from the platform's native network code.

This package is designed to facilitate platform error communication across language boundaries
in Outline Client, particularly between Go and TypeScript.

By using this package, Go code can effectively transmit detailed error to TypeScript, where the
[PlatformError] is converted into a TypeScript equivalent type for seamless handling.
*/
package platerrors
