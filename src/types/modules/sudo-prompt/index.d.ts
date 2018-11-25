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
    name?: string, icns?: string
  }

  export function exec(
      command: string, options?: SudoPromptOptions,
      // Even though from reading the source it looks like error would be an
      // instance of Error, in practice it's almost always a string: a simple
      // error message in some cases, e.g. when the user does not grant
      // permission, or the output of the command - with newlines! - when the
      // command fails.
      //
      // However, because we've seen error reports from users indicating that in
      // some cases it is indeed an Error, use a union type and force the caller
      // to handle both cases.
      callback?: (error: string|Error, stdout: string|Buffer, stderr: string|Buffer) => void): void;
}
