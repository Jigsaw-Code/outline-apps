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

import {cp, mkdir} from 'node:fs/promises';
import path from 'path';
import rmfr from 'rmfr';
import {execSync} from 'child_process';

/**
 * @description Builds the parameterized cordova binary (ios, macos, android).
 *
 * @param {string[]} parameters
 */
export async function main(...parameters) {
  const PLATFORM = parameters[0];

  const PLUGIN_OUTPUT = path.join(process.env.BUILD_DIR, 'cordova', 'plugin');
  await rmfr(PLUGIN_OUTPUT);
  await mkdir(PLUGIN_OUTPUT, {recursive: true});

  await cp(path.join(process.env.ROOT_DIR, 'src', 'cordova', 'plugin'), PLUGIN_OUTPUT, {recursive: true});

  // Android
  if (PLATFORM === 'android') {
    const ANDROID_LIB_DIR = path.join(PLUGIN_OUTPUT, 'android', 'libs');
    await mkdir(ANDROID_LIB_DIR, {recursive: true});
    await cp(
      path.join(process.env.ROOT_DIR, 'third_party', 'outline-go-tun2socks', 'android', 'tun2socks.aar'),
      path.join(ANDROID_LIB_DIR, 'tun2socks.aar')
    );
    await cp(
      path.join(process.env.ROOT_DIR, 'third_party', 'outline-go-tun2socks', 'android', 'jni'),
      path.join(ANDROID_LIB_DIR, 'obj'),
      {recursive: true}
    );
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
