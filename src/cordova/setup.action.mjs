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

import cordovaLib from 'cordova-lib';
const {cordova} = cordovaLib;

import {getRootDir} from '../build/get_root_dir.mjs';
import {getBuildEnvironment} from '../build/get_build_environment.mjs';
import {parseXmlFile} from '../build/parse_xml_file.mjs';
import {writeXmlFile} from '../build/write_xml_file.mjs';
import {runAction} from '../build/run_action.mjs';
import {getBuildParameters} from '../build/get_build_parameters.mjs';
import {spawnStream} from '../build/spawn_stream.mjs';

const WORKING_CORDOVA_OSX_COMMIT = '07e62a53aa6a8a828fd988bc9e884c38c3495a67';

/**
 * @description Prepares the paramterized cordova project (ios, macos, android) for being built.
 * We have a couple custom things we must do - like rsyncing code from our apple project into the project
 * cordova creates.
 *
 * @param {string[]} parameters
 */
export async function main(...parameters) {
  const {platform, buildMode, verbose} = getBuildParameters(parameters);
  const {APP_VERSION, APP_BUILD_NUMBER} = getBuildEnvironment(parameters);

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
      return androidRelease(APP_VERSION, APP_BUILD_NUMBER, verbose);
    case 'ios' + 'debug':
      return appleIosDebug(verbose);
    case 'macos' + 'debug':
      return appleMacOsDebug(verbose);
    case 'ios' + 'release':
      return appleIosRelease(APP_VERSION, APP_BUILD_NUMBER, verbose);
    case 'macos' + 'release':
      return appleMacOsRelease(APP_VERSION, APP_BUILD_NUMBER, verbose);
    case 'browser' + 'debug':
    default:
      return cordova.prepare({
        platforms: ['browser'],
        save: false,
      });
  }
}

const transformXmlFiles = async (filelist, callback, options = {}) =>
  Promise.all(
    filelist.map(async filepath => writeXmlFile(filepath, callback(await parseXmlFile(filepath, options)), options))
  );

async function androidDebug(verbose) {
  return cordova.prepare({
    platforms: ['android'],
    save: false,
    verbose,
  });
}

async function androidRelease(version, buildNumber, verbose) {
  await cordova.prepare({
    platforms: ['android'],
    save: false,
    verbose,
  });

  return transformXmlFiles(
    [path.join(getRootDir(), 'platforms', 'android', 'CordovaLib', 'AndroidManifest.xml')],
    xml => {
      xml.manifest['@android:versionName'] = version;
      xml.manifest['@android:versionCode'] = buildNumber;
      return xml;
    },
    {verbose}
  );
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
  return spawnStream('rsync', '-avc', 'src/cordova/apple/xcode/ios/', 'platforms/ios/');
}

async function appleMacOsDebug(verbose) {
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
  return spawnStream('rsync', '-avc', 'src/cordova/apple/xcode/macos/', 'platforms/osx/');
}

const XML_VERSION_STRING_INDEX = 1;
const XML_BUILD_NUMBER_INDEX = 3;

const transformAppleXmlFiles = async (platform, version, buildNumber, verbose) =>
  transformXmlFiles(
    [`platforms/${platform}/Outline/Outline-Info.plist`, `platforms/${platform}/Outline/VpnExtension-Info.plist`],
    xml => {
      xml.plist.dict['#'][XML_VERSION_STRING_INDEX].string = version;
      xml.plist.dict['#'][XML_BUILD_NUMBER_INDEX].string = buildNumber;

      return xml;
    },
    {
      dtd: {
        pubID: '-//Apple//DTD PLIST 1.0//EN',
        sysID: 'http://www.apple.com/DTDs/PropertyList-1.0.dtd',
      },
      verbose,
    }
  );

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

  return transformAppleXmlFiles('ios', version, buildNumber, verbose);
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

  return transformAppleXmlFiles('osx', version, buildNumber, verbose);
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
