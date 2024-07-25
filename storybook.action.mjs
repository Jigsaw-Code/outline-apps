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

import path from 'path';
import url from 'url';

import image from '@rollup/plugin-image';
import {startDevServer} from '@web/dev-server';
import {esbuildPlugin} from '@web/dev-server-esbuild';
import {fromRollup} from '@web/dev-server-rollup';
import {storybookPlugin} from '@web/dev-server-storybook';

import {getRootDir} from './src/build/get_root_dir.mjs';

const WWW_PATH = ['src', 'www'];
const STORYBOOK_PATH = [...WWW_PATH, '.storybook'];

/**
 * @description Starts the storybook for UI development.
 */
export async function main() {
  await startDevServer({
    config: {
      nodeResolve: true,
      open: true,
      watch: true,
      rootDir: path.resolve(getRootDir(), ...WWW_PATH),
      mimeTypes: {
        // serve all png files as js so as to not confuse rollup
        '**/*.png': 'js',
      },
      plugins: [
        fromRollup(image)({
          include: ['./client//**/*.png'],
        }),
        esbuildPlugin({
          ts: true,
          json: true,
        }),
        storybookPlugin({
          type: 'web-components',
          configDir: path.resolve(getRootDir(), ...STORYBOOK_PATH),
        }),
      ],
    },
  });
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
