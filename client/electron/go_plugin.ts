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
  const result = await getDefaultBackendChannel().invokeMethod(method, input);
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

/** A token to uniquely identify a callback. */
export type CallbackToken = number;

/**
 * Registers a callback function in TypeScript, making it invokable from Go.
 *
 * The caller can unregister the callback by calling `unregisterCallback`.
 *
 * @param callback The callback function to be registered.
 * @returns A Promise resolves to the callback token, which can be used to refer to the callback.
 */
export async function registerCallback(
  callback: CallbackFunction
): Promise<CallbackToken> {
  console.debug('[Backend] - calling registerCallback ...');
  const token = await getDefaultCallbackManager().register(callback);
  console.debug('[Backend] - registerCallback done, token:', token);
  return token;
}

/**
 * Unregisters a specified callback function from the Go backend to release resources.
 *
 * @param token The callback token returned from `registerCallback`.
 * @returns A Promise that resolves when the unregistration is done.
 */
export async function unregisterCallback(token: CallbackToken): Promise<void> {
  console.debug('[Backend] - calling unregisterCallback, token:', token);
  await getDefaultCallbackManager().unregister(token);
  console.debug('[Backend] - unregisterCallback done, token:', token);
}

/** Singleton of the CGo callback manager. */
let callback: CallbackManager | undefined;

function getDefaultCallbackManager(): CallbackManager {
  if (!callback) {
    callback = new CallbackManager(getDefaultBackendChannel());
  }
  return callback;
}

class CallbackManager {
  /** `const char* (*CallbackFuncPtr)(const char *data);` */
  private readonly callbackFuncPtr: koffi.IKoffiCType;

  /** `int RegisterCallback(CallbackFuncPtr cb);` */
  private readonly registerCallback: Function;

  /** `void UnregisterCallback(int token);` */
  private readonly unregisterCallback: Function;

  /**
   * Koffi requires us to register all persistent callbacks; we track the registrations here.
   * @see https://koffi.dev/callbacks#registered-callbacks
   */
  private readonly koffiCallbacks = new Map<
    CallbackToken,
    koffi.IKoffiRegisteredCallback
  >();

  constructor(backend: BackendChannel) {
    this.callbackFuncPtr = koffi.pointer(
      koffi.proto('CallbackFuncPtr', 'str', [backend.cgoString])
    );
    this.registerCallback = backend.declareCGoFunction(
      'RegisterCallback',
      'int',
      [this.callbackFuncPtr]
    );
    this.unregisterCallback = backend.declareCGoFunction(
      'UnregisterCallback',
      'void',
      ['int']
    );
  }

  async register(callback: CallbackFunction): Promise<CallbackToken> {
    const persistentCallback = koffi.register(callback, this.callbackFuncPtr);
    const token = await this.registerCallback(persistentCallback);
    this.koffiCallbacks.set(token, persistentCallback);
    return token;
  }

  async unregister(token: CallbackToken): Promise<void> {
    await this.unregisterCallback(token);
    const persistentCallback = this.koffiCallbacks.get(token);
    if (persistentCallback) {
      koffi.unregister(persistentCallback);
      this.koffiCallbacks.delete(token);
    }
  }
}

/** Singleton of the CGo backend channel. */
let backend: BackendChannel | undefined;

function getDefaultBackendChannel(): BackendChannel {
  if (!backend) {
    backend = new BackendChannel();
  }
  return backend;
}

class BackendChannel {
  /** The backend library instance of koffi */
  private readonly library: koffi.IKoffiLib;

  /** An auto releasable `const char *` type in koffi */
  readonly cgoString: koffi.IKoffiCType;

  /** `InvokeMethodResult InvokeMethod(char* method, char* input);` */
  readonly invokeMethod: Function;

  constructor() {
    this.library = koffi.load(pathToBackendLibrary());

    // Define shared types
    this.cgoString = koffi.disposable(
      'CGoAutoReleaseString',
      'str',
      this.library.func('FreeCGoString', 'void', ['str'])
    );

    const invokeMethodResult = koffi.struct('InvokeMethodResult', {
      Output: this.cgoString,
      ErrorJson: this.cgoString,
    });
    this.invokeMethod = this.declareCGoFunction(
      'InvokeMethod',
      invokeMethodResult,
      ['str', 'str']
    );
  }

  declareCGoFunction(
    name: string,
    result: koffi.TypeSpec,
    args: koffi.TypeSpec[]
  ): Function {
    return promisify(this.library.func(name, result, args).async);
  }
}
