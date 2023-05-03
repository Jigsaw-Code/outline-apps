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
import {getCordovaBuildParameters} from './get_cordova_build_parameters.mjs';
import {getRootDir} from '../build/get_root_dir.mjs';
import {spawnStream} from '../build/spawn_stream.mjs';
import {getBuildEnvironment} from '../build/get_build_environment.mjs';
import {parseXmlFile} from '../build/parse_xml_file.mjs';
import {writeXmlFile} from '../build/write_xml_file.mjs';

/**
 * @description Builds the parameterized cordova binary (ios, macos, android).
 *
 * @param {string[]} parameters
 */
export async function main(...parameters) {
  const {platform: cordovaPlatform, candidateId, buildMode, verbose} = getCordovaBuildParameters(parameters);
  const outlinePlatform = cordovaPlatform === 'osx' ? 'macos' : cordovaPlatform;
  const {APP_VERSION, APP_BUILD_NUMBER} = getBuildEnvironment(buildMode, candidateId);

  await runAction('cordova/setup', ...parameters);

  if (buildMode === 'debug') {
    console.warn(`WARNING: building "${outlinePlatform}" in [DEBUG] mode. Do not publish this build!!`);
  }

  if (cordovaPlatform === 'osx' || cordovaPlatform === 'ios') {
    const {
      plist: {
        dict: [{key: outlineInfoPlistKeys, string: outlineInfoPlistValues}],
        ...rest
      },
    } = await parseXmlFile(`src/cordova/apple/xcode/${cordovaPlatform}/Outline/Outline-Info.plist`);

    outlineInfoPlistKeys.push('CFBundleShortVersionString', 'CFBundleVersion');
    outlineInfoPlistValues.push(APP_VERSION, APP_BUILD_NUMBER);

    await writeXmlFile(`src/cordova/apple/xcode/${cordovaPlatform}/Outline/Outline-Info.plist`, {
      plist: {dict: [{key: outlineInfoPlistKeys, string: outlineInfoPlistValues}], ...rest},
    });

    const {
      plist: {
        dict: [{key: outlineVpnExtensionPlistKeys, string: outlineVpnExtensionPlistValues}],
      },
    } = await parseXmlFile(`src/cordova/apple/xcode/${cordovaPlatform}/Outline/VpnExtension-Info.plist`);

    outlineVpnExtensionPlistKeys.push('CFBundleShortVersionString');
    outlineVpnExtensionPlistValues.push(APP_VERSION);

    await writeXmlFile(`src/cordova/apple/xcode/${cordovaPlatform}/Outline/VpnExtension-Info.plist`, {
      plist: {dict: [{key: outlineInfoPlistKeys, string: outlineInfoPlistValues}], ...rest},
    });

    const xcodebuildBaseArguments = [
      'xcodebuild',
      'clean',
      '-workspace',
      path.join(getRootDir(), 'src', 'cordova', 'apple', `${outlinePlatform}.xcworkspace`),
      '-scheme',
      'Outline',
      '-destination',
      cordovaPlatform === 'ios' ? 'generic/platform=iOS' : 'generic/platform=macOS',
    ];

    if (buildMode === 'release') {
      return spawnStream(...xcodebuildBaseArguments, 'archive', '-configuration', 'Release');
    }

    // TODO(fortuna): Specify the -destination parameter for build. Do we need it for archive?
    return spawnStream(
      ...xcodebuildBaseArguments,
      'build',
      '-configuration',
      'Debug',
      'CODE_SIGN_IDENTITY=""',
      'CODE_SIGNING_ALLOWED="NO"'
    );
  }

  if (cordovaPlatform === 'android') {
    let argv = [
      // Path is relative to /platforms/android/.
      // See https://docs.gradle.org/current/userguide/composite_builds.html#command_line_composite
      '--gradleArg=--include-build=../../src/cordova/android/OutlineAndroidLib',
    ];

    if (verbose) {
      argv.push('--gradleArg=--info');
      cordova.on('verbose', message => console.debug(`[cordova:verbose] ${message}`));
    }

    if (buildMode === 'release') {
      if (!(process.env.ANDROID_KEY_STORE_PASSWORD && process.env.ANDROID_KEY_STORE_CONTENTS)) {
        throw new ReferenceError(
          "Both 'ANDROID_KEY_STORE_PASSWORD' and 'ANDROID_KEY_STORE_CONTENTS' must be defined in the environment to build an Android Release!"
        );
      }
      // TODO: inject version and build number into config.xml
      argv = [
        ...argv,
        '--keystore=keystore.p12',
        '--alias=privatekey',
        `--storePassword=${process.env.ANDROID_KEY_STORE_PASSWORD}`,
        `--password=${process.env.ANDROID_KEY_STORE_PASSWORD}`,
        '--',
        '--gradleArg=-PcdvBuildMultipleApks=true',
      ];
    }

    return cordova.compile({
      verbose,
      platforms: ['android'],
      options: {
        release: buildMode === 'release',
        argv,
      },
    });

    // TODO: revert changed version files
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
