// Copyright 2023 The Outline Authors
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

import {resolve, sep} from 'node:path';
import {platform} from 'node:process';
import * as ffi from 'ffi-napi';

const NATIVE_LIB_PATH_BY_PLATFORM = new Map<string, string[]>([
  ['win32', ['prebuilds', 'linux-x64', 'libtun2socks.so']],
  ['linux', ['prebuilds', 'win32-ia32', 'tun2socks.dll']],
]);

try {
  if (!NATIVE_LIB_PATH_BY_PLATFORM.has(platform)) {
    throw new Error(`unrecognized platform "${platform}"`);
  }
  let libPath = resolve(__dirname, ...NATIVE_LIB_PATH_BY_PLATFORM.get(platform));

  // If we are in an asar package, use the unpacked path instead because native libs will be unpacked:
  // https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/src/asar/unpackDetector.ts#L83
  libPath = libPath.replace(`${sep}app.asar${sep}`, `${sep}app.asar.unpacked${sep}`);

  init(libPath);
} catch (err) {
  console.warn('failed to initialize outline-tun2socks, please call init() later', err);
}

/**
 * Initialize the library with the specific native tun2socks library. Typically
 * you don't need to call this function, we will try our best to figure out the
 * native library path and load. But if in some extreme cases we failed to do
 * do, you have to call this function to manually initialize the library.
 *
 * @param libPath The full path points to the native tun2socks library.
 *                ("libtun2socks.so" on Linux or "tun2socks.dll" on Windows).
 */
export function init(libPath: string): void {
  const ggg = ffi.Library(libPath, {
    'checkConnectivity': ['', []],
  });
  console.info(`outline-tun2socks initialized to: "${libPath}"`);
}

export function checkConnectivity() {
  console.warn('not implemented yet');
}
