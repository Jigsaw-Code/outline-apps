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

import url from 'url';

import cordovaLib from 'cordova-lib';
const {cordova} = cordovaLib;

import {runAction} from '../build/run_action.mjs';
import {getCordovaBuildParameters} from './get_cordova_build_parameters.mjs';
import {execSync} from 'child_process';
import * as path from 'node:path';

/**
 * @description Builds the parameterized cordova binary (ios, macos, android).
 *
 * @param {string[]} parameters
 */
export async function main(...parameters) {
  const {platform: cordovaPlatform, buildMode} = getCordovaBuildParameters(parameters);

  await runAction('cordova/setup', ...parameters);

  if (buildMode === 'debug') {
    console.warn(`WARNING: building "${cordovaPlatform}" in [DEBUG] mode. Do not publish this build!!`);
  }

  if (cordovaPlatform === 'osx') {
    const WORKSPACE_PATH = path.join(process.env.ROOT_DIR, 'src', 'cordova', 'apple', 'macos.xcworkspace');
    const BUILD_CONFIG = buildMode === 'release' ? 'Release' : 'Debug';
    const ACTION = buildMode === 'release' ? 'clean archive' : 'build';
    execSync(`xcodebuild -workspace ${WORKSPACE_PATH} -scheme Outline -configuration ${BUILD_CONFIG} ${ACTION}`, {
      stdio: 'inherit',
    });
    return;
  }

  let argv = [];

  if (cordovaPlatform === 'android' && buildMode === 'release') {
    if (!(process.env.ANDROID_KEY_STORE_PASSWORD && process.env.ANDROID_KEY_STORE_CONTENTS)) {
      throw new ReferenceError(
        "Both 'ANDROID_KEY_STORE_PASSWORD' and 'ANDROID_KEY_STORE_CONTENTS' must be defined in the environment to build an Android Release!"
      );
    }

    argv = [
      '--keystore=keystore.p12',
      '--alias=privatekey',
      `--storePassword=${process.env.ANDROID_KEY_STORE_PASSWORD}`,
      `--password=${process.env.ANDROID_KEY_STORE_PASSWORD}`,
      '--',
      '--gradleArg=-PcdvBuildMultipleApks=true',
    ];
  }

  await cordova.compile({
    platforms: [cordovaPlatform],
    options: {
      device: cordovaPlatform === 'ios' && buildMode === 'release',
      emulator: cordovaPlatform === 'ios' && buildMode === 'debug',
      release: buildMode === 'release',
      argv,
    },
  });
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
