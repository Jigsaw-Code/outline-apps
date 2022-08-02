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
import url from 'url';
import {existsSync} from 'fs';
import {execSync} from 'child_process';
import path from 'path';
import rmfr from 'rmfr';

import cordovaLib from 'cordova-lib';
const {cordova} = cordovaLib;

import {runAction} from '../build/run_action.mjs';
import {getBuildParameters} from '../build/get_build_parameters.mjs';
import {getCordovaBuildParameters} from './get_cordova_build_parameters.mjs';

const CORDOVA_PLATFORMS = ['ios', 'osx', 'android', 'browser'];
const WORKING_CORDOVA_OSX_COMMIT = '07e62a53aa6a8a828fd988bc9e884c38c3495a67';

/**
 * @description Prepares the paramterized cordova project (ios, macos, android) for being built.
 * We have a couple custom things we must do - like rsyncing code from our apple project into the project
 * cordova creates.
 *
 * @param {string[]} parameters
 */
export async function main(...parameters) {
  const {platform, buildMode} = getCordovaBuildParameters(parameters);
  const {platform: outlinePlatform} = getBuildParameters(parameters);
  const isApple = platform === 'ios' || platform === 'osx';

  if (!CORDOVA_PLATFORMS.includes(platform)) {
    throw new TypeError(
      `The platform "${platform}" is not a valid Cordova platform. It must be one of: ${CORDOVA_PLATFORMS.join(', ')}.`
    );
  }

  if (isApple && os.platform() !== 'darwin') {
    throw new Error('Building an Apple binary requires xcodebuild and can only be done on MacOS');
  }

  await runAction('www/build', outlinePlatform, `--buildMode=${buildMode}`);

  await rmfr(`platforms/${platform}`);

  if (!existsSync(path.resolve(process.env.ROOT_DIR, `platforms/${platform}`))) {
    await cordova.platform(
      'add',
      [platform === 'osx' ? `github:apache/cordova-osx#${WORKING_CORDOVA_OSX_COMMIT}` : platform],
      {save: false}
    );
  }

  await cordova.prepare({platforms: [platform], save: false});

  if (isApple) {
    // since apple can only be build on darwin systems, we don't have to worry about windows support here
    // TODO(daniellacosse): move this to a cordova hook
    execSync(`rsync -avc src/cordova/apple/xcode/${outlinePlatform}/ platforms/${platform}/`, {
      stdio: 'inherit',
    });
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
