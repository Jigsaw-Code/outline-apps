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

import path from 'node:path';
import url from 'url';

import cordovaLib from 'cordova-lib';
const {cordova} = cordovaLib;

import {runAction} from '../build/run_action.mjs';
import {getRootDir} from '../build/get_root_dir.mjs';
import {spawnStream} from '../build/spawn_stream.mjs';
import {getBuildParameters} from '../build/get_build_parameters.mjs';

/**
 * @description Builds the parameterized cordova binary (ios, macos, android).
 *
 * @param {string[]} parameters
 */
export async function main(...parameters) {
  const {platform, buildMode, verbose} = getBuildParameters(parameters);

  await runAction('www/build', ...parameters);
  await runAction('cordova/setup', ...parameters);

  switch (platform + buildMode) {
    case 'android' + 'debug':
      return androidDebug(verbose);
    case 'android' + 'release':
      return androidRelease(process.env.ANDROID_KEY_STORE_PASSWORD, process.env.ANDROID_KEY_STORE_CONTENTS, verbose);
    case 'ios' + 'debug':
    case 'macos' + 'debug':
      return appleDebug(platform);
    case 'ios' + 'release':
    case 'macos' + 'release':
      return appleRelease(platform);
  }
}

async function appleDebug(platform) {
  console.warn(`WARNING: building "${platform}" in [DEBUG] mode. Do not publish this build!!`);

  return spawnStream(
    'xcodebuild',
    'clean',
    '-workspace',
    path.join(getRootDir(), 'src', 'cordova', 'apple', `${platform}.xcworkspace`),
    '-scheme',
    'Outline',
    '-destination',
    platform === 'ios' ? 'generic/platform=iOS' : 'generic/platform=macOS',
    'build',
    '-configuration',
    'Debug',
    'CODE_SIGN_IDENTITY=""',
    'CODE_SIGNING_ALLOWED="NO"'
  );
}

async function appleRelease(platform) {
  return spawnStream(
    'xcodebuild',
    'clean',
    '-workspace',
    path.join(getRootDir(), 'src', 'cordova', 'apple', `${platform}.xcworkspace`),
    '-scheme',
    'Outline',
    '-destination',
    platform === 'ios' ? 'generic/platform=iOS' : 'generic/platform=macOS',
    'archive',
    '-configuration',
    'Release'
  );
}

async function androidDebug(verbose) {
  console.warn(`WARNING: building "android" in [DEBUG] mode. Do not publish this build!!`);

  if (verbose) {
    cordova.on('verbose', message => console.debug(`[cordova:verbose] ${message}`));
  }

  return cordova.compile({
    verbose,
    platforms: ['android'],
    options: {
      argv: [
        // Path is relative to /platforms/android/.
        // See https://docs.gradle.org/current/userguide/composite_builds.html#command_line_composite
        '--gradleArg=--include-build=../../src/cordova/android/OutlineAndroidLib',
        verbose ? '--gradleArg=--info' : '--gradleArg=--quiet',
      ],
    },
  });
}

async function androidRelease(ksPassword, ksContents, verbose) {
  if (!(ksPassword && ksContents)) {
    throw new ReferenceError(
      "Both 'ANDROID_KEY_STORE_PASSWORD' and 'ANDROID_KEY_STORE_CONTENTS' must be defined in the environment to build an Android Release!"
    );
  }

  if (verbose) {
    cordova.on('verbose', message => console.debug(`[cordova:verbose] ${message}`));
  }

  return cordova.compile({
    verbose,
    platforms: ['android'],
    options: {
      release: true,
      argv: [
        // Path is relative to /platforms/android/.
        // See https://docs.gradle.org/current/userguide/composite_builds.html#command_line_composite
        '--gradleArg=--include-build=../../src/cordova/android/OutlineAndroidLib',
        verbose ? '--gradleArg=--info' : '--gradleArg=--quiet',
        '--keystore=keystore.p12',
        '--alias=privatekey',
        `--storePassword=${ksPassword}`,
        `--password=${ksContents}`,
        '--',
        '--gradleArg=-PcdvBuildMultipleApks=true',
      ],
    },
  });
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
