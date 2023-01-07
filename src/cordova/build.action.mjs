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

import os from 'node:os';
import fs from 'node:fs';

/**
 * @description Builds the parameterized cordova binary (ios, macos, android).
 *
 * @param {string[]} parameters
 */
export async function main(...parameters) {
  const {platform: cordovaPlatform, buildMode} = getCordovaBuildParameters(parameters);
  const outlinePlatform = cordovaPlatform === 'osx' ? 'macos' : cordovaPlatform;

  await runAction('cordova/setup', ...parameters);

  if (buildMode === 'debug') {
    console.warn(`WARNING: building "${cordovaPlatform}" in [DEBUG] mode. Do not publish this build!!`);
  }

  if (outlinePlatform === 'macos' || outlinePlatform === 'ios') {
    const WORKSPACE_PATH = `${process.env.ROOT_DIR}/src/cordova/apple/${outlinePlatform}.xcworkspace`;
    // TODO(fortuna): Specify the -destination parameter for build. Do we need it for archive?
    if (buildMode === 'release') {
      execSync(`xcodebuild -workspace ${WORKSPACE_PATH} -scheme Outline -configuration Release clean archive`, {
        stdio: 'inherit',
      });
    } else {
      execSync(
        `xcodebuild -workspace ${WORKSPACE_PATH} -scheme Outline -configuration Debug build CODE_SIGN_IDENTITY="" CODE_SIGNING_ALLOWED=NO`,
        {
          stdio: 'inherit',
        }
      );
    }
    return;
  }
  if (cordovaPlatform === 'android') {
    await checkSdkFolderIsWritable();

    let argv = [];
    if (buildMode === 'release') {
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
      platforms: ['android'],
      options: {
        release: buildMode === 'release',
        argv,
      },
    });
    return;
  }
}

async function checkSdkFolderIsWritable() {
  const sdkFolder = process.env.ANDROID_SDK_ROOT;
  if (!isFolderWritable(sdkFolder)) {
    console.error(`The sdk folder '${sdkFolder}' is not writable! Android builds will fail.`);
    const uid = os.userInfo().uid;
    if (uid !== 0) {
      console.error(`It might be non-writable because you are running as ${uid} instead of running as root.`);
      console.error(`A workaround is to run 'node ./src/cordova/build.action.mjs' instead of 'npm run action cordova/build'`);
    }
    process.exit(1);
  }
}

async function isFolderWritable(folder) {
  return await fs.promises.access(folder, fs.constants.W_OK).then(() => true, () => false);
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
