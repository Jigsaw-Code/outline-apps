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

import {cpSync, mkdirSync} from 'fs';
import path from 'path';
import rmfr from 'rmfr';
import {execSync} from 'child_process';

/**
 * @description Builds the parameterized cordova binary (ios, macos, android).
 *
 * @param {string[]} parameters
 */
export async function main() {
  const PLUGIN_OUTPUT = path.join(process.env.BUILD_DIR, 'cordova', 'plugin');
  await rmfr(PLUGIN_OUTPUT);
  mkdirSync(PLUGIN_OUTPUT, {recursive: true});

  cpSync(path.join(process.env.ROOT_DIR, 'src', 'cordova', 'plugin'), PLUGIN_OUTPUT, {recursive: true});

  // Android
  const ANDROID_LIB_DIR = path.join(PLUGIN_OUTPUT, 'android', 'libs');
  mkdirSync(ANDROID_LIB_DIR, {recursive: true});
  cpSync(
    path.join(process.env.ROOT_DIR, 'third_party', 'outline-go-tun2socks', 'android', 'tun2socks.aar'),
    path.join(ANDROID_LIB_DIR, 'tun2socks.aar')
  );
  cpSync(
    path.join(process.env.ROOT_DIR, 'third_party', 'outline-go-tun2socks', 'android', 'jni'),
    path.join(ANDROID_LIB_DIR, 'obj'),
    {recursive: true}
  );

  // Apple
  execSync('echo "Building CocoaLumberjack" && cd third_party/CocoaLumberjack && make', {stdio: 'inherit'});
  execSync('echo "Building sentry-cocoa" && cd third_party/sentry-cocoa && make', {stdio: 'inherit'});
  for (const platform of ['ios', 'macos']) {
    const LIB_DIR = path.join(PLUGIN_OUTPUT, 'apple', 'lib', platform);
    mkdirSync(LIB_DIR, {recursive: true});
    cpSync(
      path.join(
        process.env.BUILD_DIR,
        'third_party',
        'CocoaLumberjack',
        'Carthage',
        'Build',
        'CocoaLumberjack.xcframework'
      ),
      path.join(LIB_DIR, 'CocoaLumberjack.xcframework'),
      {recursive: true}
    );
    cpSync(
      path.join(
        process.env.BUILD_DIR,
        'third_party',
        'CocoaLumberjack',
        'Carthage',
        'Build',
        'CocoaLumberjackSwift.xcframework'
      ),
      path.join(LIB_DIR, 'CocoaLumberjackSwift.xcframework'),
      {recursive: true}
    );
    cpSync(
      path.join(process.env.BUILD_DIR, 'third_party', 'sentry-cocoa', 'Carthage', 'Build', 'Sentry.xcframework'),
      path.join(LIB_DIR, 'Sentry.xcframework'),
      {recursive: true}
    );
    cpSync(
      path.join(process.env.ROOT_DIR, 'third_party', 'outline-go-tun2socks', 'apple', 'Tun2socks.xcframework'),
      path.join(LIB_DIR, 'Tun2socks.xcframework'),
      {recursive: true}
    );
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
