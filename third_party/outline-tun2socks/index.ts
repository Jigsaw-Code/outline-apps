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
import {promisify} from 'node:util';

import ffi from 'ffi-napi';
import ref from 'ref-napi';
import init_struct, {StructObject} from 'ref-struct-di';

const ffiStruct = init_struct(ref);

// native function definitions
let nativeLib : {
  readonly CheckConnectivity: ffi.ForeignFunction<StructObject<{
    status: number,
    pErr: ref.Pointer<unknown>,
  }>, []>,

  readonly ReleaseObject: ffi.ForeignFunction<void, [ref.Pointer<unknown>]>,
} | undefined;


const NATIVE_LIB_PATH_BY_PLATFORM = new Map<string, string[]>([
  ['linux', ['prebuilds', 'linux-x64', 'libtun2socks.so']],
  ['win32', ['prebuilds', 'win32-ia32', 'tun2socks.dll']],
]);

/**
 * Initialize the library with the specific folder path containing the native
 * tun2socks library. Typically it should be the parent folder of this file.
 * In electron, the folder is within ".../app.asar.unpacked/node_modules/".
 *
 * @param libPath The full folder path containing the prebuilt native tun2socks
 *                library.
 */
export function init(libPath: string): void {
  if (!NATIVE_LIB_PATH_BY_PLATFORM.has(platform)) {
    throw new Error(`unrecognized platform "${platform}"`);
  }
  libPath = resolve(libPath, ...NATIVE_LIB_PATH_BY_PLATFORM.get(platform));
  const checkConnRetType = ffiStruct({
    status: ref.types.uint32,
    pErr: 'void*',
  });
  nativeLib = ffi.Library(libPath, {
    'CheckConnectivity': [checkConnRetType, []],
    'ReleaseObject': [ref.types.void, ['void*']],
  });
  console.info(`outline-tun2socks initialized to: "${libPath}"`);
}

export enum ConnectivityStatus {
  TcpAndUdpConnectable = 0,
  OnlyTcpConnectable = 4,
  AuthenticationFailure = 3,
  ServerUnreachable = 5,
}

export async function checkConnectivity(): Promise<ConnectivityStatus> {
  if (!nativeLib) {
    throw new Error('outline-tun2socks is not initialized, please call init() first');
  }
  let pErr: ref.Pointer<unknown> = ref.NULL_POINTER;
  try {
    const r = await promisify(nativeLib.CheckConnectivity.async)();
    pErr = r.pErr;
    console.info(r.status, pErr);
    if (pErr.isNull) {
      switch (r.status) {
        case 0: return ConnectivityStatus.TcpAndUdpConnectable;
        case 4: return ConnectivityStatus.OnlyTcpConnectable;
        case 3: return ConnectivityStatus.AuthenticationFailure;
        case 5: return ConnectivityStatus.ServerUnreachable;
        default: throw new Error(`unrecognized return value ${status}`);
      }
    } else {
      console.error('todo: get error info from pErr');
      throw new Error('todo');
    }
  } finally {
    nativeLib.ReleaseObject(pErr);
  }
}
