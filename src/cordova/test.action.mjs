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

import {getCordovaBuildParameters} from './get_cordova_build_parameters.mjs';
import {execSync} from 'child_process';

/**
 * @description Tests the parameterized cordova binary (ios, macos).
 *
 * @param {string[]} parameters
 */
export async function main(...parameters) {
  const {platform: cordovaPlatform, buildMode, verbose} = getCordovaBuildParameters(parameters);
  const outlinePlatform = cordovaPlatform === 'osx' ? 'macos' : cordovaPlatform;

  console.log('Testing OutlineAppleLib on "${outlinePlatform}"');

  if (outlinePlatform === 'macos' || outlinePlatform === 'ios') {
    const PACKAGE_PATH = `${process.env.ROOT_DIR}/src/cordova/apple/OutlineAppleLib/`;
    const PACKAGE_NAME = `OutlineAppleLib`;

    if (outlinePlatform === 'macos') {
      // Test arm macs
      execSync(`xcodebuild test -scheme ${PACKAGE_NAME} -destination 'platform=macOS,arch=arm64'`, {
        cwd: PACKAGE_PATH,
        stdio: 'inherit',
      });

      // Test intel macs
      execSync(`xcodebuild test -scheme ${PACKAGE_NAME} -destination 'platform=macOS,arch=x86_64'`, {
        cwd: PACKAGE_PATH,
        stdio: 'inherit',
      });

      // Test catalyst
      execSync(`xcodebuild test -scheme ${PACKAGE_NAME} -destination 'platform=macOS,arch=x86_64'`, {
        cwd: PACKAGE_PATH,
        stdio: 'inherit',
      });
    }

    if (outlinePlatform === 'ios') {
      // Test iPhone 14, iOS 16.2
      execSync(`xcodebuild test -scheme ${PACKAGE_NAME} -destination 'platform=iOS Simulator,name=iPhone 14,OS=16.2'`, {
        cwd: PACKAGE_PATH,
        stdio: 'inherit',
      });

      // Test iPhone X, iOS 13.7
      execSync(`xcodebuild test -scheme ${PACKAGE_NAME} -destination 'platform=iOS Simulator,name=iPhone X,OS=13.7'`, {
        cwd: PACKAGE_PATH,
        stdio: 'inherit',
      });
    }
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
