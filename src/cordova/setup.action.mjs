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
import rmfr from 'rmfr';
import path from 'path';

import replace from 'replace-in-file';
import cordovaLib from 'cordova-lib';
const {cordova} = cordovaLib;

import {getRootDir} from '../build/get_root_dir.mjs';
import {runAction} from '../build/run_action.mjs';
import {getBuildParameters} from '../build/get_build_parameters.mjs';
import {spawnStream} from '../build/spawn_stream.mjs';
import chalk from 'chalk';

const WORKING_CORDOVA_OSX_COMMIT = '07e62a53aa6a8a828fd988bc9e884c38c3495a67';

/**
 * @description Prepares the paramterized cordova project (ios, macos, android) for being built.
 * We have a couple custom things we must do - like rsyncing code from our apple project into the project
 * cordova creates.
 *
 * @param {string[]} parameters
 */
export async function main(...parameters) {
  const {platform, buildMode, verbose, buildNumber, versionName} = getBuildParameters(parameters);

  await runAction('www/build', ...parameters);

  await rmfr(path.resolve(getRootDir(), 'platforms'));
  await rmfr(path.resolve(getRootDir(), 'plugins'));

  if (verbose) {
    cordova.on('verbose', message => console.debug(`[cordova:verbose] ${message}`));
  }

  switch (platform + buildMode) {
    case 'android' + 'debug':
      return androidDebug(verbose);
    case 'android' + 'release':
      console.warn('NOTE: You must open the Outline.zip file after building to upload to the Play Store.');
      return androidRelease(versionName, buildNumber, verbose);
    case 'ios' + 'debug':
    case 'maccatalyst' + 'debug':
      return appleIosDebug(verbose);
    case 'macos' + 'debug':
      return appleMacOsDebug(verbose);
    case 'ios' + 'release':
    case 'maccatalyst' + 'release':
      return appleIosRelease(versionName, buildNumber, verbose);
    case 'macos' + 'release':
      return appleMacOsRelease(versionName, buildNumber, verbose);
    case 'browser' + 'debug':
    default:
      return cordova.prepare({
        platforms: ['browser'],
        save: false,
      });
  }
}

async function androidDebug(verbose) {
  await cordova.prepare({
    platforms: ['android'],
    save: false,
    verbose,
  });
}

async function makeReplacements(replacements) {
  let results = [];

  for (const replacement of replacements) {
    results = [...results, ...(await replace(replacement))];
  }
}

async function androidRelease(versionName, buildNumber, verbose) {
  await cordova.prepare({
    platforms: ['android'],
    save: false,
    verbose,
  });

  const manifestXmlGlob = path.join(getRootDir(), 'platforms', 'android', '**', 'AndroidManifest.xml');
  const configXmlGlob = path.join(getRootDir(), 'platforms', 'android', '**', 'config.xml');

  await makeReplacements([
    {
      files: manifestXmlGlob,
      from: ['android:versionName="1.0"', 'android:versionName="0.0.0-debug"'],
      to: `android:versionName="${versionName}"`,
    },
    {
      files: manifestXmlGlob,
      from: 'android:versionCode="1"',
      to: `android:versionCode="${buildNumber}"`,
    },
    {
      files: configXmlGlob,
      from: 'version="0.0.0-debug"',
      to: `version="${versionName}"`,
    },
    {
      files: configXmlGlob,
      from: 'android-versionCode="1"',
      to: `android-versionCode="${buildNumber}"`,
    },
  ]);
}

async function appleIosDebug(verbose) {
  if (os.platform() !== 'darwin') {
    throw new Error('Building an Apple binary requires xcodebuild and can only be done on MacOS');
  }

  await cordova.prepare({
    platforms: ['ios'],
    save: false,
    verbose,
  });

  // TODO(daniellacosse): move this to a cordova hook
  await spawnStream('rsync', '-avc', 'src/cordova/apple/xcode/ios/', 'platforms/ios/');
}

async function appleMacOsDebug(verbose) {
  if (os.platform() !== 'darwin') {
    throw new Error('Building an Apple binary requires xcodebuild and can only be done on MacOS');
  }

  console.warn(
    chalk.yellow('Debug mode on the MacOS client is currently broken. Try running with `--buildMode=release` instead.')
  );

  await cordova.platform('add', [`github:apache/cordova-osx#${WORKING_CORDOVA_OSX_COMMIT}`], {save: false});

  await cordova.prepare({
    platforms: ['osx'],
    save: false,
    verbose,
  });

  // TODO(daniellacosse): move this to a cordova hook
  await spawnStream('rsync', '-avc', 'src/cordova/apple/xcode/macos/', 'platforms/osx/');
}

async function setAppleVersion(platform, versionName, buildNumber) {
  await makeReplacements([
    {
      files: `platforms/${platform}/Outline/*.plist`,
      from: /<key>CFBundleShortVersionString<\/key>\s*<string>.*<\/string>/g,
      to: `<key>CFBundleShortVersionString</key>\n  <string>${versionName}</string>`,
    },
    {
      files: `platforms/${platform}/Outline/*.plist`,
      from: /<key>CFBundleVersion<\/key>\s*<string>.*<\/string>/g,
      to: `<key>CFBundleVersion</key>\n  <string>${buildNumber}</string>`,
    },
  ]);
}

async function appleIosRelease(version, buildNumber, verbose) {
  if (os.platform() !== 'darwin') {
    throw new Error('Building an Apple binary requires xcodebuild and can only be done on MacOS');
  }

  await cordova.prepare({
    platforms: ['ios'],
    save: false,
    verbose,
  });

  // TODO(daniellacosse): move this to a cordova hook
  await spawnStream('rsync', '-avc', 'src/cordova/apple/xcode/ios/', 'platforms/ios/');

  await setAppleVersion('ios', version, buildNumber);
}

async function appleMacOsRelease(version, buildNumber, verbose) {
  if (os.platform() !== 'darwin') {
    throw new Error('Building an Apple binary requires xcodebuild and can only be done on MacOS');
  }

  await cordova.platform('add', [`github:apache/cordova-osx#${WORKING_CORDOVA_OSX_COMMIT}`], {save: false});

  await cordova.prepare({
    platforms: ['osx'],
    save: false,
    verbose,
  });

  // TODO(daniellacosse): move this to a cordova hook
  await spawnStream('rsync', '-avc', 'src/cordova/apple/xcode/macos/', 'platforms/osx/');

  await setAppleVersion('osx', version, buildNumber);
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
