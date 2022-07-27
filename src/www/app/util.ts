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

import * as errors from '../model/errors';

export function timeoutPromise<T>(promise: Promise<T>, timeoutDuration: number, timeoutName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new errors.OperationTimedOut(timeoutDuration, timeoutName)), timeoutDuration)
    ),
  ]);
}

/**
 * Catching custom errors (even as simple as numbers) does not work in ipcRenderer:
 *   - https://github.com/electron/electron/issues/24427
 *
 * We will return error code in IPC handlers (similar to return err in golang)
 * and convert it back to Outline error here. If it is NO_ERROR, nothing will happen.
 * @param err The error code returned by an IPC message
 */
export function throwIfIpcError(err: errors.ErrorCode | object | undefined): void {
  if (typeof err === 'number') {
    if (err !== errors.ErrorCode.NO_ERROR) {
      throw new errors.OutlinePluginError(err);
    }
  } else {
    console.warn(`IPC error must be an ErrorCode, but it is ${typeof err}`);
    if (typeof err !== 'undefined' && err !== null) {
      throw err;
    }
  }
}
