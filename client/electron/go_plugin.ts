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

/**
 * Calls a Go function by invoking the `InvokeMethod` function in the native backend library.
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
export async function invokeGoMethod(
  method: string,
  input: string
): Promise<string> {
  console.debug(`[Backend] - calling InvokeMethod "${method}" ...`);
  const result = await ensureCgo().invokeMethod(method, input);
  console.debug(`[Backend] - InvokeMethod "${method}" returned`, result);
  if (result.ErrorJson) {
    throw new Error(result.ErrorJson);
  }
  return result.Output;
}

/**
 * Represents a function that will be called from the Go backend.
 * @param data The data string passed from the Go backend.
 * @returns A result string that will be passed back to the caller.
 */
export type CallbackFunction = (data: string) => string;

/** A unique token for a callback created by `newCallback`. */
export type CallbackToken = number;

/**
 * Koffi requires us to register all persistent callbacks; we track the registrations here.
 * @see https://koffi.dev/callbacks#registered-callbacks
 */
const koffiCallbacks = new Map<CallbackToken, koffi.IKoffiRegisteredCallback>();

/**
 * Registers a callback function in TypeScript, making it invokable from Go.
 *
 * The caller can delete the callback by calling `deleteCallback`.
 *
 * @param callback The callback function to be registered.
 * @returns A Promise resolves to the callback token, which can be used to refer to the callback.
 */
export async function newCallback(
  callback: CallbackFunction
): Promise<CallbackToken> {
  console.debug('[Backend] - calling newCallback ...');
  const persistentCallback = koffi.register(
    callback,
    ensureCgo().callbackFuncPtr
  );
  const token = await ensureCgo().newCallback(persistentCallback);
  console.debug('[Backend] - newCallback done, token:', token);
  koffiCallbacks.set(token, persistentCallback);
  return token;
}

/**
 * Unregisters a specified callback function from the Go backend.
 *
 * @param token The callback token returned from `newCallback`.
 * @returns A Promise that resolves when the unregistration is done.
 */
export async function deleteCallback(token: CallbackToken): Promise<void> {
  console.debug('[Backend] - calling deleteCallback:', token);
  await ensureCgo().deleteCallback(token);
  console.debug('[Backend] - deleteCallback done');
  const persistentCallback = koffiCallbacks.get(token);
  if (persistentCallback) {
    koffi.unregister(persistentCallback);
    koffiCallbacks.delete(token);
    console.debug(
      `[Backend] - unregistered persistent callback ${token} from koffi`
    );
  }
}

/** Interface containing the exported native CGo functions. */
interface CgoFunctions {
  // InvokeMethodResult InvokeMethod(char* method, char* input);
  invokeMethod: Function;

  // void (*CallbackFuncPtr)(const char *data);
  callbackFuncPtr: koffi.IKoffiCType;

  // InvokeMethodResult NewCallback(CallbackFuncPtr cb);
  newCallback: Function;

  // void DeleteCallback(char* token);
  deleteCallback: Function;
}

/** Singleton of the loaded native CGo functions. */
let cgo: CgoFunctions | undefined;

/**
 * Ensures that the CGo functions are loaded and initialized, returning the singleton instance.
 *
 * @returns The loaded CGo functions singleton.
 */
function ensureCgo(): CgoFunctions {
  if (!cgo) {
    console.debug('[Backend] - initializing cgo environment ...');
    const backendLib = koffi.load(pathToBackendLibrary());

    // Define C strings and setup auto release
    const cgoString = koffi.disposable(
      'CGoAutoReleaseString',
      'str',
      backendLib.func('FreeCGoString', 'void', ['str'])
    );

    // Define InvokeMethod data structures and function
    const invokeMethodResult = koffi.struct('InvokeMethodResult', {
      Output: cgoString,
      ErrorJson: cgoString,
    });
    const invokeMethod = promisify(
      backendLib.func('InvokeMethod', invokeMethodResult, ['str', 'str']).async
    );

    // Define callback data structures and functions
    const callbackFuncPtr = koffi.pointer(
      koffi.proto('CallbackFuncPtr', 'str', [cgoString])
    );
    const newCallback = promisify(
      backendLib.func('NewCallback', 'int', [callbackFuncPtr]).async
    );
    const deleteCallback = promisify(
      backendLib.func('DeleteCallback', 'void', ['int']).async
    );

    // Cache them so we don't have to reload these functions
    cgo = {invokeMethod, callbackFuncPtr, newCallback, deleteCallback};
    console.debug('[Backend] - cgo environment initialized');
  }
  return cgo;
}
