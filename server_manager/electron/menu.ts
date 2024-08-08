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

import * as electron from 'electron';

// We only want a menu if we're running on macOS or in debug mode, or both.
// Note that when invoked via the electron command line tool, default_app
// adds a menu. We can't disable that.
export function getMenuTemplate(
  debugMode: boolean
): Electron.MenuItemConstructorOptions[] {
  const template: Electron.MenuItemConstructorOptions[] = [];

  if (process.platform === 'darwin') {
    template.push(
      // From default_app's main.js.
      {
        role: 'appMenu',
        submenu: electron.Menu.buildFromTemplate([
          {role: 'about'},
          {type: 'separator'},
          {role: 'services', submenu: []},
          {type: 'separator'},
          {role: 'hide'},
          {role: 'hideOthers'},
          {role: 'unhide'},
          {type: 'separator'},
          {role: 'quit'},
        ]),
      },
      // editMenu is required for copy+paste keyboard shortcuts to work on Mac.
      {role: 'editMenu'}
    );
  }

  if (debugMode) {
    template.push({
      label: 'Developer',
      submenu: electron.Menu.buildFromTemplate([
        {role: 'reload'},
        {role: 'forceReload'},
        {role: 'toggleDevTools'},
      ]),
    });
  }

  return template;
}
