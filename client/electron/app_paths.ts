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

import * as os from 'os';
import * as path from 'path';

import {app} from 'electron';

const isWindows = os.platform() === 'win32';

/**
 * Get the unpacked asar folder path.
 *   - For AppImage, `/tmp/.mount_OutlinXXXXXX/resources/app.asar.unpacked/`
 *   - For Debian, `/opt/Outline/resources/app.asar.unpacked`
 *   - For Windows, `C:\Program Files (x86)\Outline\`
 * @returns A string representing the path of the unpacked asar folder.
 */
function unpackedAppPath() {
  return app.getAppPath().replace('app.asar', 'app.asar.unpacked');
}

/**
 * Get the parent directory path of the current application binary.
 *   - For AppImage, `/tmp/.mount_OutlinXXXXX/resources/app.asar`
 *   - For Debian, `/opt/Outline/resources/app.asar`
 *   - For Windows, `C:\Program Files (x86)\Outline\`
 * @returns A string representing the path of the application directory.
 */
export function getAppPath() {
  const electronAppPath = app.getAppPath();
  if (isWindows && electronAppPath.includes('app.asar')) {
    return path.dirname(app.getPath('exe'));
  }
  return electronAppPath;
}

export function pathToEmbeddedTun2socksBinary() {
  return path.join(
    unpackedAppPath(),
    'client',
    'output',
    'build',
    isWindows ? 'windows' : 'linux',
    'tun2socks' + (isWindows ? '.exe' : '')
  );
}

/**
 * Get the parent directory path containing the background service binaries.
 * On Windows, this folder contains `OutlineService.exe`.
 * While on Linux this folder contains `outline_proxy_controller`.
 * @returns A string representing the path of the directory that contains service binaries.
 */
export function pathToEmbeddedOutlineService() {
  if (isWindows) {
    return getAppPath();
  }
  return path.join(
    unpackedAppPath(),
    'client',
    'electron',
    'linux_proxy_controller',
    'dist'
  );
}
