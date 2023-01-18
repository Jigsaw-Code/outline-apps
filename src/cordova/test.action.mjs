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
import os from 'os';

import cordovaLib from 'cordova-lib';
const {cordova} = cordovaLib;

import {getBuildParameters} from '../build/get_build_parameters.mjs';
import {execSync} from 'child_process';
import {getRootDir} from '../build/get_root_dir.mjs';
import path from 'path';

/**
 * @description Tests the parameterized cordova binary (ios, macos).
 *
 * @param {string[]} parameters
 */
export async function main(...parameters) {
  const {platform: cordovaPlatform, osVersion, deviceModel, cpuArchitecture} = getBuildParameters(parameters);
  const outlinePlatform = cordovaPlatform === 'osx' ? 'macos' : cordovaPlatform;

  console.log(`Testing OutlineAppleLib on ${outlinePlatform}, ${osVersion}`);

  if (outlinePlatform === 'macos' || outlinePlatform === 'ios') {
    if (os.platform() !== 'darwin') {
      throw new Error('Building an Apple binary requires xcodebuild and can only be done on MacOS');
    }

    const PACKAGE_PATH = path.join(getRootDir(), '/src/cordova/apple/OutlineAppleLib/');
    const PACKAGE_NAME = `OutlineAppleLib`;

    if (outlinePlatform === 'macos') {
      let xcodeDestination = `platform=macOS,arch=${cpuArchitecture}`;

      if (osVersion) {
        xcodeDestination += `OS=${osVersion}`;
      }

      execSync(`xcodebuild test -scheme "${PACKAGE_NAME}" -destination "${xcodeDestination}"`, {
        cwd: PACKAGE_PATH,
        stdio: 'inherit',
      });
    }

    if (outlinePlatform === 'ios') {
      let xcodeDestination = `platform=iOS Simulator,name=${deviceModel},OS=${osVersion}`;
      execSync(`xcodebuild test -scheme "${PACKAGE_NAME}" -destination "${xcodeDestination}"`, {
        cwd: PACKAGE_PATH,
        stdio: 'inherit',
      });
    }
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
