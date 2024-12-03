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

import {promisify} from 'node:util';

import koffi from 'koffi';

import {pathToBackendLibrary} from './app_paths';

let invokeGoAPIFunc: Function | undefined;

/**
 * Calls a Go function by invoking the `InvokeGoAPI` function in the native backend library.
 *
 * @param method The name of the Go method to invoke.
 * @param input The input string to pass to the API.
 * @returns A Promise that resolves to the output string returned by the API.
 * @throws An Error containing PlatformError details if the API call fails.
 *
 * @remarks
 * Ensure that the function signature and data structures are consistent with the C definitions
 * in `./client/go/outline/electron/go_plugin.go`.
 */
export async function invokeGoApi(method: string, input: string): Promise<string> {
  if (!invokeGoAPIFunc) {
    const backendLib = koffi.load(pathToBackendLibrary());

    // Define C strings and setup auto release
    const cgoString = koffi.disposable(
      'CGoAutoReleaseString',
      'str',
      backendLib.func('FreeCGoString', 'void', ['str'])
    );

    // Define InvokeGoAPI data structures and function
    const invokeGoApiResult = koffi.struct('InvokeGoAPIResult', {
      Output: cgoString,
      ErrorJson: cgoString,
    });
    invokeGoAPIFunc = promisify(
      backendLib.func('InvokeGoAPI', invokeGoApiResult, ['str', 'str']).async
    );
  }

  console.debug('[Backend] - calling InvokeGoAPI ...');
  const result = await invokeGoAPIFunc(method, input);
  console.debug('[Backend] - InvokeGoAPI returned', result);
  if (result.ErrorJson) {
    throw Error(result.ErrorJson);
  }
  return result.Output;
}
