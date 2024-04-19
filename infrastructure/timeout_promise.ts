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

import {CustomError} from './custom_error';

export class OperationTimedOut extends CustomError {
  constructor(public readonly timeoutMs: number, public readonly operationName: string) {
    super();
  }
}

export function timeoutPromise<T>(promise: Promise<T>, timeoutDuration: number, timeoutName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new OperationTimedOut(timeoutDuration, timeoutName)), timeoutDuration)
    ),
  ]);
}
