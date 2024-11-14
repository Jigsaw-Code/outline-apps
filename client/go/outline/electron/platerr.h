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

#pragma once

// PlatformError represents an error that originate from the native network code.
typedef struct t_PlatformError
{

  // A code can be used to identify the specific type of the error.
  // Caller is responsible for freeing this pointer using FreeCGoString.
  const char *Code;

  // A JSON string of the error details that can be parsed by TypeScript.
  // Caller is responsible for freeing this pointer using FreeCGoString.
  const char *DetailJson;

} PlatformError;
