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

import path from 'path';
import url from 'url';

import {createReloadServer} from '@outline/infrastructure/build/create_reload_server.mjs';
import {getRootDir} from '@outline/infrastructure/build/get_root_dir.mjs';
import {runAction} from '@outline/infrastructure/build/run_action.mjs';
import cordovaLib from 'cordova-lib';
import {hashElement} from 'folder-hash';
import * as fs from "fs-extra";
const {cordova} = cordovaLib;

import {getBuildParameters} from '../../build/get_build_parameters.mjs';

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
export async function main(...parameters) {
  const {platform, verbose} = getBuildParameters(parameters);

  if (platform !== 'macos') {
    throw new Error('Only macos platform is currently supported');
  }

  await runAction('client/src/www/build', ...parameters);
  await runAction('client/go/build', ...parameters);
  await runAction('client/src/cordova/setup', ...parameters);

  if (verbose) {
    cordova.on('verbose', message =>
      console.debug(`[cordova:verbose] ${message}`)
    );
  }

  let previousUIHashResult = await getUIHash();

  console.log('Starting reload server @ port 35729...');
  createReloadServer(async () => {
    const currentUIHashResult = await getUIHash();

    if (previousUIHashResult === currentUIHashResult) {
      return false;
    }

    previousUIHashResult = currentUIHashResult;

    await runAction('client/src/www/build', ...parameters);

    await fs.copy(
      path.join(getRootDir(), 'client/www'),
      // TODO: find way to programmatically get this path
      path.join('/Users/daniellacosse/Library/Developer/Xcode/DerivedData/macos-XXXXXXX/Build/Products/Debug/Outline.app/Contents/Resources/www'),
    );

    return true;
  }).listen(35729);
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
