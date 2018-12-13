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

import {app} from 'electron';
import * as fs from 'fs';
import * as fsextra from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

const isWindows = os.platform() === 'win32';
const isLinux = os.platform() === 'linux';

const LINUX_DAEMON_FILENAME = 'OutlineProxyController';
const LINUX_DAEMON_SYSTEMD_SERVICE_FILENAME = 'outline_proxy_controller.service';
const LINUX_INSTALLER_FILENAME = 'install_linux_service.sh';

// The returned path must be kept in sync with:
//  - the destination path for the binaries in build_action.sh
//  - the value specified for --config.asarUnpack in package_action.sh
export function pathToEmbeddedBinary(filename: string) {
  return path.join(
      __dirname.replace('app.asar', 'app.asar.unpacked'), 'bin', os.platform(),
      filename + (isWindows ? '.exe' : ''));
}

export function getServiceStartCommand(): string {
  if (isWindows) {
    // Locating the script is tricky: when packaged, this basically boils down to:
    //   c:\program files\Outline\
    // but during development:
    //   build/windows
    //
    // Surrounding quotes important, consider "c:\program files"!
    return `"${
        path.join(
            app.getAppPath().includes('app.asar') ? path.dirname(app.getPath('exe')) :
                                                    app.getAppPath(),
            'install_windows_service.bat')}"`;
  } else if (isLinux) {
    return path.join(copyServiceFilesToTempFolder(), LINUX_INSTALLER_FILENAME);
  } else {
    throw new Error('unsupported os');
  }
}

// On some distributions, root is not allowed access the AppImage folder: copy the files to /tmp.
function copyServiceFilesToTempFolder() {
  const tmp = fs.mkdtempSync('/tmp');
  [LINUX_DAEMON_FILENAME, LINUX_DAEMON_SYSTEMD_SERVICE_FILENAME, LINUX_INSTALLER_FILENAME].forEach(
      (filename) => {
        const src = pathToEmbeddedBinary(filename);
        // https://github.com/jprichardson/node-fs-extra/issues/323
        const dest = path.join(tmp, filename);
        fsextra.copySync(src, dest, {overwrite: true});
      });
  return tmp;
}
