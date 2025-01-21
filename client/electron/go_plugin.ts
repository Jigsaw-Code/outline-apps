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
    throw Error(result.ErrorJson);
  }
  return result.Output;
}

/**
 * Represents a callback function for an event.
 * @param data The event data string passed from the source.
 * @param param The param string provided during registration.
 */
export type CallbackFunction = (data: string, param: string) => void;

/**
 * Subscribes to an event from the Go backend.
 *
 * @param name The name of the event to subscribe to.
 * @param callback The callback function to be called when the event is fired.
 * @param param An optional parameter to be passed to the callback function.
 * @returns A Promise that resolves when the subscription is successful.
 *
 * @remarks Subscribing to an event will replace any previously subscribed callback for that event.
 */
export async function subscribeEvent(
  name: string,
  callback: CallbackFunction,
  param: string | null = null
): Promise<void> {
  console.debug(`[Backend] - calling SubscribeEvent "${name}" "${param}" ...`);
  await ensureCgo().subscribeEvent(
    name,
    registerKoffiCallback(name, callback),
    param
  );
  console.debug(`[Backend] - SubscribeEvent "${name}" done`);
}

/**
 * Unsubscribes from an event from the Go backend.
 *
 * @param name The name of the event to unsubscribe from.
 * @returns A Promise that resolves when the unsubscription is successful.
 */
export async function unsubscribeEvent(name: string): Promise<void> {
  console.debug(`[Backend] - calling UnsubscribeEvent "${name}" ...`);
  await ensureCgo().unsubscribeEvent(name);
  unregisterKoffiCallback(name);
  console.debug(`[Backend] - UnsubscribeEvent "${name}" done`);
}

/** Interface containing the exported native CGo functions. */
interface CgoFunctions {
  // InvokeMethodResult InvokeMethod(char* method, char* input);
  invokeMethod: Function;

  // void (*ListenerFunc)(const char *data, const char *param);
  listenerFuncPtr: koffi.IKoffiCType;

  // void SubscribeEvent(char* eventName, ListenerFunc callback, char* param);
  subscribeEvent: Function;

  // void UnsubscribeEvent(char* eventName);
  unsubscribeEvent: Function;
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

    // Define SubscribeEvent/UnsubscribeEvent data structures and function
    const listenerFuncPtr = koffi.pointer(
      koffi.proto('ListenerFunc', 'void', [cgoString, cgoString])
    );
    const subscribeEvent = promisify(
      backendLib.func('SubscribeEvent', 'void', ['str', listenerFuncPtr, 'str'])
        .async
    );
    const unsubscribeEvent = promisify(
      backendLib.func('UnsubscribeEvent', 'void', ['str']).async
    );

    // Cache them so we don't have to reload these functions
    cgo = {invokeMethod, listenerFuncPtr, subscribeEvent, unsubscribeEvent};
    console.debug('[Backend] - cgo environment initialized');
  }
  return cgo;
}

//#region Koffi's internal registration management

const koffiCallbacks = new Map<string, koffi.IKoffiRegisteredCallback>();

/**
 * Registers a persistent JS callback function with Koffi.
 * This will replace any previously registered functions to align with `subscribeEvent`.
 *
 * @param eventName The name of the event.
 * @param jsCallback The JavaScript callback function.
 * @returns The registered Koffi callback.
 * @see https://koffi.dev/callbacks#registered-callbacks
 */
function registerKoffiCallback(
  eventName: string,
  jsCallback: CallbackFunction
): koffi.IKoffiRegisteredCallback {
  unregisterKoffiCallback(eventName);
  const koffiCb = koffi.register(jsCallback, ensureCgo().listenerFuncPtr);
  koffiCallbacks.set(eventName, koffiCb);
  return koffiCb;
}

/**
 * Unregisters a Koffi callback for a specific event.
 *
 * @param eventName The name of the event.
 */
function unregisterKoffiCallback(eventName: string): void {
  const cb = koffiCallbacks.get(eventName);
  if (cb) {
    koffi.unregister(cb);
    koffiCallbacks.delete(eventName);
  }
}

//#endregion Koffi's internal registration management
