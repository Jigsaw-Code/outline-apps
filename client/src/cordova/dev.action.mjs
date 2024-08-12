// Copyright 2022 The Outline Authors
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

import os from 'os';
import path from 'path';
import url from 'url';

import {createReloadServer} from '@outline/infrastructure/build/create_reload_server.mjs';
import {getRootDir} from '@outline/infrastructure/build/get_root_dir.mjs';
import {runAction} from '@outline/infrastructure/build/run_action.mjs';
import {spawnStream} from '@outline/infrastructure/build/spawn_stream.mjs';
import chalk from 'chalk';
import {hashElement} from 'folder-hash';
import * as fs from 'fs-extra';

import {makeReplacements} from '../../build/make_replacements.mjs';

const OUTPUT_PATH = 'output/build/client/macos';
const OUTLINE_APP_PATH = 'Debug/Outline.app';
const OUTLINE_APP_WWW_PATH = 'Contents/Resources/www';
const RELOAD_SERVER_PORT = 35729;

const getUIHash = async () => {
  const hashResult = await hashElement(
    path.join(getRootDir(), 'client/src/www'),
    {
      files: {include: ['**/*.ts', '**/*.html', '**/*.css', '**/*.js']},
    }
  );

  return hashResult.hash;
};

/**
 * @description Builds the parameterized cordova binary (ios, macos, maccatalyst, android).
 *
 * @param {string[]} parameters
 */
export async function main() {
  console.warn(
    chalk.yellow(
      'This action only works for the MacOS platform. Ignoring all inputs.'
    )
  );

  if (os.platform() !== 'darwin') {
    throw new Error('You must be on MacOS to develop for MacOS.');
  }

  // TODO: respect the parameters passed to the action once the debug macos build is working
  const parameters = [
    'macos',
    '--buildMode=release',
    '--sentryDsn=https://public@sentry.example.com/1',
    '--versionName=0.0.0-dev',
  ];

  await runAction('client/src/www/build', ...parameters);
  await runAction('client/go/build', ...parameters);
  await runAction('client/src/cordova/setup', ...parameters);

  await makeReplacements([
    {
      files: path.join(
        getRootDir(),
        'client/platforms/osx/wvw/index_cordova.html'
      ),
      from: '<app-root></app-root>',
      to: `<app-root></app-root>

    <script>
      try {
        const reloadSocket = new WebSocket("ws://localhost:35729");

        reloadSocket.onopen = () => console.log("LiveReload connected~");
        reloadSocket.onmessage = ({ data }) => data === "reload" && location.reload();
      } catch (e) {
        // nevermind
      }
    </script>`,
    },
  ]);

  await spawnStream(
    'xcodebuild',
    '-scheme',
    'Outline',
    '-workspace',
    path.join(getRootDir(), 'client/src/cordova/apple/macos.xcworkspace'),
    `SYMROOT=${path.join(getRootDir(), OUTPUT_PATH)}`
  );

  await spawnStream(
    'open',
    path.join(getRootDir(), OUTPUT_PATH, OUTLINE_APP_PATH)
  );

  let previousUIHashResult = await getUIHash();

  console.log(`Starting reload server @ port ${RELOAD_SERVER_PORT}...`);
  createReloadServer(async () => {
    const currentUIHashResult = await getUIHash();

    if (previousUIHashResult === currentUIHashResult) {
      return false;
    }

    previousUIHashResult = currentUIHashResult;

    await runAction('client/src/www/build', ...parameters);

    await fs.copy(
      path.join(getRootDir(), 'client/www'),
      path.join(OUTPUT_PATH, OUTLINE_APP_PATH, OUTLINE_APP_WWW_PATH)
    );

    return true;
  }).listen(RELOAD_SERVER_PORT);
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
