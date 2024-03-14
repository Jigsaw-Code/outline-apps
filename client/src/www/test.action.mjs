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

import minimist from 'minimist';
import url from 'url';
import karma from 'karma';
import puppeteer from 'puppeteer';
import path from 'path';
import {getRootDir} from '../build/get_root_dir.mjs';

const KARMA_CONFIG_PATH = ['src', 'www', 'karma.conf.js'];

/**
 * @description Runs the Karma tests against the web UI.
 *
 * @param {string[]} parameters
 */
export async function main(...parameters) {
  // We need to manually kill the process on SIGINT, otherwise the web server
  // stays alive in the background.
  process.on('SIGINT', process.exit);

  const {watch = false} = minimist(parameters);

  const runKarma = config =>
    new Promise((resolve, reject) => {
      new karma.Server(config, exitCode => {
        console.log('Karma exited with code:', exitCode);
        if (exitCode !== 0) {
          reject(exitCode);
        }

        resolve(exitCode);
      }).start();
    });

  process.env.CHROMIUM_BIN = puppeteer.executablePath();

  const config = await karma.config.parseConfig(
    path.resolve(getRootDir(), ...KARMA_CONFIG_PATH),
    {singleRun: !watch},
    {
      promiseConfig: true,
      throwErrors: true,
    }
  );
  await runKarma(config);
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
