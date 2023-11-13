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

import fs from 'node:fs/promises';

import {spawnStream} from '../build/spawn_stream.mjs';
import {getBuildParameters} from '../build/get_build_parameters.mjs';
import {getRootDir} from '../build/get_root_dir.mjs';

/**
 * @description TODO: Add description
 *
 * @param {string[]} parameters
 */
export async function main(...parameters) {
  const {platform} = getBuildParameters(parameters);

  const outputDir = `${getRootDir()}/build/${platform}/tun2socks`;

  await fs.mkdir(outputDir, {recursive: true});

  switch (platform) {
    case 'android':
      return spawnStream(
        'gomobile',
        '-a',
        '-androidapi=33',
        '-ldflags=-w',
        '-tags=android',
        '-target=android',
        '-work',
        `-o=${outputDir}`,
        'github.com/Jigsaw-Code/outline-client/src/tun2socks/outline/tun2socks',
        'github.com/Jigsaw-Code/outline-client/src/tun2socks/outline/shadowsocks'
      );
    case 'ios':
      return spawnStream(
        'gomobile',
        '-bundleid=org.outline.tun2socks',
        '-iosversion=13.1',
        "-ldflags='-s -w'",
        '-target=ios,iossimulator',
        `-o=${outputDir}`,
        'github.com/Jigsaw-Code/outline-client/src/tun2socks/outline/tun2socks',
        'github.com/Jigsaw-Code/outline-client/src/tun2socks/outline/shadowsocks'
      );
    case 'macos':
      process.env.MACOSX_DEPLOYMENT_TARGET = '10.14';

      return spawnStream(
        'gomobile',
        '-bundleid=org.outline.tun2socks',
        '-iosversion=13.1',
        "-ldflags='-s -w'",
        '-target=macos,maccatalyst',
        `-o=${outputDir}`,
        'github.com/Jigsaw-Code/outline-client/src/tun2socks/outline/tun2socks',
        'github.com/Jigsaw-Code/outline-client/src/tun2socks/outline/shadowsocks'
      );
    case 'windows':
      return spawnStream(
        'xgo',
        '-targets=windows/386',
        "-ldflags='-s -w -X main.version=v1.16.11'",
        `-dest=${outputDir}`,
        '-pkg=outline/electron',
        `${getRootDir()}/src/tun2socks`
      );
    case 'linux':
      return spawnStream(
        'xgo',
        '-targets=linux/amd64',
        "-ldflags='-s -w -X main.version=v1.16.11'",
        `-dest=${outputDir}`,
        '-pkg=outline/electron',
        `${getRootDir()}/src/tun2socks`
      );
  }
}
