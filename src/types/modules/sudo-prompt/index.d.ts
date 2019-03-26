// Copyright 2018 The Outline Authors
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

// Typings for:
// https://www.npmjs.com/package/sudo-prompt

declare module 'sudo-prompt' {
  export interface SudoPromptOptions {
    name?: string;
    icns?: string;
  }

  export function exec(
      command: string, options?: SudoPromptOptions,
      // NOTE: The callback arguments are a mess and differ from platform to platform. This is for
      //       Linux, where stdout/stderr are never set and the error always says "User did not
      //       grant permission." *even if the user did grant permission but the script exited with
      //       a non-zero status*.
      callback?: (error?: Error) => void): void;
}
