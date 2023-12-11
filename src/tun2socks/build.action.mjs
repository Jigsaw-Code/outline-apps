// Copyright 2023 The Outline Authors
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
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import {spawnStream} from '../build/spawn_stream.mjs';
import {getBuildParameters} from '../build/get_build_parameters.mjs';

/**
 * @description Builds the tun2socks library for the specified platform.
 *
 * @param {string[]} parameters
 */
export async function main(...parameters) {
  const {platform: targetPlatform} = getBuildParameters(parameters);

  const binDir = path.join(process.env.OUTPUT_DIR, 'bin');
  const buildDir = path.join(
    process.env.BUILD_DIR,
    ['ios', 'macos', 'maccatalyst'].includes(targetPlatform) ? 'apple' : targetPlatform,
    'tun2socks'
  );

  await fs.mkdir(binDir, {recursive: true});
  await fs.mkdir(buildDir, {recursive: true});

  // install go tools locally
  await spawnStream(
    'go',
    'build',
    '-o',
    binDir,
    'golang.org/x/mobile/cmd/gomobile',
    'golang.org/x/mobile/cmd/gobind',
    'github.com/crazy-max/xgo'
  );

  const hostPlatform = os.platform();

  process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH}`;

  switch (targetPlatform + hostPlatform) {
    case 'android' + 'darwin':
    case 'android' + 'linux':
    case 'android' + 'win32':
      return spawnStream(
        'gomobile',
        'bind',
        '-androidapi=33',
        '-target=android',
        `-o=${buildDir}/tun2socks.aar`,

        'github.com/Jigsaw-Code/outline-client/src/tun2socks/outline/tun2socks',
        'github.com/Jigsaw-Code/outline-client/src/tun2socks/outline/shadowsocks'
      );
    case 'ios' + 'darwin':
      return spawnStream(
        'gomobile',
        'bind',
        '-bundleid=org.outline.tun2socks',
        '-iosversion=12.0',
        `-target=ios,iossimulator`,
        `-o=${buildDir}/tun2socks.xcframework`,

        'github.com/Jigsaw-Code/outline-client/src/tun2socks/outline/tun2socks',
        'github.com/Jigsaw-Code/outline-client/src/tun2socks/outline/shadowsocks'
      );
    case 'macos' + 'darwin':
    case 'maccatalyst' + 'darwin':
      process.env.MACOSX_DEPLOYMENT_TARGET = '10.14';

      return spawnStream(
        'gomobile',
        'bind',
        '-bundleid=org.outline.tun2socks',
        '-iosversion=13.1',
        `-target=macos,maccatalyst`,
        `-o=${buildDir}/tun2socks.xcframework`,

        'github.com/Jigsaw-Code/outline-client/src/tun2socks/outline/tun2socks',
        'github.com/Jigsaw-Code/outline-client/src/tun2socks/outline/shadowsocks'
      );
    case 'windows' + 'linux':
    case 'windows' + 'darwin':
      await spawnStream(
        'xgo',
        '-targets=windows/386',
        `-dest=${buildDir}`,

        '-pkg=src/tun2socks/outline/electron',
        '-out=tun2socks',
        '.'
      );

      return spawnStream('cp', `${buildDir}/tun2socks-windows-386.exe`, `${buildDir}/tun2socks.exe`);

    case 'linux' + 'win32':
    case 'linux' + 'darwin':
      await spawnStream(
        'xgo',
        '-targets=linux/amd64',
        `-dest=${buildDir}`,

        '-pkg=src/tun2socks/outline/electron',
        '-out=tun2socks',
        '.'
      );

      return spawnStream('cp', `${buildDir}/tun2socks-linux-amd64`, `${buildDir}/tun2socks`);

    case 'windows' + 'win32':
    case 'linux' + 'linux':
      return spawnStream(
        'go',
        'build',
        '-o',
        `${buildDir}/tun2socks`,

        'github.com/Jigsaw-Code/outline-client/src/tun2socks/outline/electron'
      );
    default:
      throw new Error(`Unsupported cross-compilation: ${targetPlatform} on ${hostPlatform}`);
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
