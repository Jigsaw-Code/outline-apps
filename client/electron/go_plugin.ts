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

export type GoPlatformErrorHandle = number;

export interface GoFetchResourceResult {
  Content: string;
  Error: GoPlatformErrorHandle;
}

var goFetchResourceFunc: koffi.KoffiFunction | undefined;

export function goFetchResource(url: string): Promise<GoFetchResourceResult> {
  if (!goFetchResourceFunc) {
    const lib = ensureBackendLibraryLoaded();
    const resultStruct = koffi.struct('FetchResourceResult', {
      Content: 'CStr',
      Error: 'GoPlatformErrorHandle',
    });
    goFetchResourceFunc = lib.func('FetchResource', resultStruct, ['str']);
  }
  return promisify(goFetchResourceFunc.async)(url);
}

var backendLib: koffi.IKoffiLib | undefined;

function ensureBackendLibraryLoaded(): koffi.IKoffiLib {
  if (!backendLib) {
    backendLib = koffi.load(pathToBackendLibrary());
    defineCommonFunctions(backendLib);
  }
  return backendLib;
}

var goStr: koffi.IKoffiCType | undefined;
var goFreeString: koffi.KoffiFunction | undefined;

function defineCommonFunctions(lib: koffi.IKoffiLib) {
  goFreeString = lib.func('FreeString', koffi.types.void, [koffi.types.str]);
  goStr = koffi.disposable('CStr', koffi.types.str, goFreeString);
  koffi.alias('GoPlatformErrorHandle', koffi.types.uintptr_t);
}
