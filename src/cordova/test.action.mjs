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
import minimist from 'minimist';
import path from 'path';
import fs from 'fs/promises';
import rmfr from 'rmfr';

import {getRootDir} from '../build/get_root_dir.mjs';
import {spawnStream} from '../build/spawn_stream.mjs';

const APPLE_ROOT = path.join(getRootDir(), 'src', 'cordova', 'apple');
const APPLE_LIBRARY_NAME = 'OutlineAppleLib';

const SUPPORTED_PLATFORMS = new Set(['ios', 'macos', 'maccatalyst']);

/**
 * @description Tests the parameterized cordova binary (ios, macos).
 *
 * @param {string[]} parameters
 */
export async function main(...parameters) {
  const {
    _: [outlinePlatform],
  } = minimist(parameters);

  if (!SUPPORTED_PLATFORMS.has(outlinePlatform)) {
    throw new Error('Testing is only currently supported for platforms: ' + Array.from(SUPPORTED_PLATFORMS));
  }

  if (os.platform() !== 'darwin') {
    throw new Error('Building an Apple binary requires xcodebuild and can only be done on MacOS');
  }

  const derivedDataPath = path.join(process.env.COVERAGE_DIR, 'apple', outlinePlatform);

  await rmfr(derivedDataPath);
  await spawnStream(
    'xcodebuild',
    'clean',
    'test',
    '-scheme',
    `${APPLE_LIBRARY_NAME}-Package`,
    '-destination',
    outlinePlatform === 'macos'
      ? `platform=macOS,arch=${os.machine()}`
      : `platform=iOS Simulator,OS=16.2,name=iPhone SE (3rd generation)`,
    '-workspace',
    path.join(APPLE_ROOT, APPLE_LIBRARY_NAME),
    '-enableCodeCoverage',
    'YES',
    '-derivedDataPath',
    derivedDataPath
  );

  const testCoverageDirectoryPath = path.join(derivedDataPath, 'Logs', 'Test');
  const testCoverageResultFilename = (await fs.readdir(testCoverageDirectoryPath)).find(filename =>
    filename.endsWith('xcresult')
  );

  await fs.rename(
    path.join(testCoverageDirectoryPath, testCoverageResultFilename),
    path.join(derivedDataPath, 'TestResult.xcresult')
  );
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
