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

// Imports the server list from Outline Beta, if one exists, by copying localstorage from Outline
// Beta's appData directory:
//   https://electronjs.org/docs/api/app#appgetpathname
//
// This should be called after the ready event, so that the appData directory exists, but before
// creating the mainWindow (which uses and creates Local Storage/).
//
// Why is this necessary? When the productName (in package.json) changed, so did the appData
// directory, e.g. for the user "bob", the file changed from:
//   C:\Users\bob\AppData\Roaming\Outline Beta\Local Storage\whatever.localstorage
// to:
//   C:\Users\bob\AppData\Roaming\Outline\Local Storage\whatever.localstorage
//
// Note that the uninstaller does *not* clear the appData directory, so users should still have
// the beta appData directory on their system when they're updated to the new client.
export function migrateBetaServers() {
  if (os.platform() !== 'win32') {
    console.info('skipping server migration, not running on Windows');
    return;
  }

  // Path under USERDATA at which local storage can be found.
  // "file__0" seems to be the same on each platform (Linux, macOS, Windows).
  const suffix = ['Local Storage', 'file__0.localstorage'];

  const dest = path.join(app.getPath('userData'), ...suffix);
  if (fs.existsSync(dest)) {
    console.info('skipping server migration, localstorage already exists');
    return;
  }

  const src = path.normalize(path.join(app.getPath('userData'), '..', 'Outline Beta', ...suffix));
  if (!fs.existsSync(src)) {
    console.info('skipping server migration, no beta localstorage found');
    return;
  }

  try {
    // The parent folder, 'Local Storage', does not exist at this point.
    fs.mkdirSync(path.dirname(path.join(app.getPath('userData'), ...suffix)));

    // TODO: Use fs.copyFileSync once we move to an Electron with Node.js 8.5+:
    //       https://nodejs.org/dist/latest-v8.x/docs/api/fs.html#fs_fs_copyfilesync_src_dest_flags
    fsextra.copySync(src, dest, {overwrite: true, errorOnExist: true});
    console.info('migrated beta servers');
  } catch (e) {
    // Do *not* log the error since it almost certainly contains the PII-type info, viz. username.
    console.error('beta server migration failed');
  }
}
