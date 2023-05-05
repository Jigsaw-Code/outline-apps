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
import {getBuildEnvironment} from '../build/get_build_environment.mjs';
import {parseXmlFile} from '../build/parse_xml_file.mjs';
import {writeXmlFile} from '../build/write_xml_file.mjs';
import {getBuildParameters} from '../build/get_build_parameters.mjs';

/**
 * @description Builds the parameterized cordova binary (ios, macos, android).
 *
 * @param {string[]} parameters
 */
export async function main(...parameters) {
  const {platform, candidateId, buildMode, verbose} = getBuildParameters(parameters);
  const {APP_VERSION, APP_BUILD_NUMBER} = getBuildEnvironment(buildMode, candidateId);

  await runAction('cordova/setup', ...parameters);

  if (buildMode === 'debug') {
    console.warn(`WARNING: building "${platform}" in [DEBUG] mode. Do not publish this build!!`);
  }

  if (verbose && platform === 'android') {
    cordova.on('verbose', message => console.debug(`[cordova:verbose] ${message}`));
  }

  switch (platform + buildMode) {
    case 'android' + 'debug':
      return androidDebug(verbose);
    case 'android' + 'release':
      return androidRelease(
        APP_VERSION,
        APP_BUILD_NUMBER,
        process.env.ANDROID_KEY_STORE_PASSWORD,
        process.env.ANDROID_KEY_STORE_CONTENTS,
        verbose
      );
    case 'ios' + 'debug':
    case 'macos' + 'debug':
      return appleDebug(platform);
    case 'ios' + 'release':
    case 'macos' + 'release':
      return appleRelease(platform, APP_VERSION, APP_BUILD_NUMBER);
  }
}

async function appleDebug(platform) {
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

async function appleRelease(platform, version, buildNumber) {
  await spawnStream('git', 'stash');

  const {
    plist: {
      dict: [{key: outlineInfoPlistKeys, string: outlineInfoPlistValues}],
      ...outlineInfoRest
    },
  } = await parseXmlFile(`src/cordova/apple/xcode/${platform}/Outline/Outline-Info.plist`);

  outlineInfoPlistKeys.push('CFBundleShortVersionString', 'CFBundleVersion');
  outlineInfoPlistValues.push(version, buildNumber);

  await writeXmlFile(`src/cordova/apple/xcode/${platform}/Outline/Outline-Info.plist`, {
    plist: {dict: [{key: outlineInfoPlistKeys, string: outlineInfoPlistValues}], ...outlineInfoRest},
  });

  const {
    plist: {
      dict: [{key: outlineVpnExtensionPlistKeys, string: outlineVpnExtensionPlistValues}],
      ...vpnExtensionRest
    },
  } = await parseXmlFile(`src/cordova/apple/xcode/${platform}/Outline/VpnExtension-Info.plist`);

  outlineVpnExtensionPlistKeys.push('CFBundleShortVersionString');
  outlineVpnExtensionPlistValues.push(version);

  await writeXmlFile(`src/cordova/apple/xcode/${platform}/Outline/VpnExtension-Info.plist`, {
    plist: {dict: [{key: outlineInfoPlistKeys, string: outlineInfoPlistValues}], ...vpnExtensionRest},
  });

  await spawnStream(
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

  await spawnStream(
    'git',
    'reset',
    `src/cordova/apple/xcode/${platform}/Outline/Outline-Info.plist`,
    `src/cordova/apple/xcode/${platform}/Outline/VpnExtension-Info.plist`
  );
  await spawnStream('git', 'stash', 'apply');
}

async function androidDebug(verbose) {
  return cordova.compile({
    verbose,
    platforms: ['android'],
    options: {
      argv: [
        // Path is relative to /platforms/android/.
        // See https://docs.gradle.org/current/userguide/composite_builds.html#command_line_composite
        '--gradleArg=--include-build=../../src/cordova/android/OutlineAndroidLib',
        verbose ? '--gradleArg=--info' : '--gradleArg=--quiet',
        '--keystore=keystore.p12',
        '--alias=privatekey',
        `--storePassword=${process.env.ANDROID_KEY_STORE_PASSWORD}`,
        `--password=${process.env.ANDROID_KEY_STORE_PASSWORD}`,
        '--',
        '--gradleArg=-PcdvBuildMultipleApks=true',
      ],
    },
  });
}

async function androidRelease(version, buildNumber, ksPassword, ksContents, verbose) {
  if (!(ksPassword && ksContents)) {
    throw new ReferenceError(
      "Both 'ANDROID_KEY_STORE_PASSWORD' and 'ANDROID_KEY_STORE_CONTENTS' must be defined in the environment to build an Android Release!"
    );
  }

  await spawnStream('git', 'stash');

  const {widget, ...rest} = await parseXmlFile('config.xml');

  widget.$.version = version;
  widget.$['android-versionCode'] = buildNumber;

  await writeXmlFile('config.xml', {widget, ...rest});

  await cordova.compile({
    verbose,
    platforms: ['android'],
    options: {
      release: true,
      argv: [
        // Path is relative to /platforms/android/.
        // See https://docs.gradle.org/current/userguide/composite_builds.html#command_line_composite
        '--gradleArg=--include-build=../../src/cordova/android/OutlineAndroidLib',
        verbose ? '--gradleArg=--info' : '--gradleArg=--quiet',
      ],
    },
  });

  await spawnStream('git', 'reset', 'config.xml');
  await spawnStream('git', 'stash', 'apply');
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
