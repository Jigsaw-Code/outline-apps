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
import * as globby from 'globby';
import path from 'path';
import fs from 'fs/promises';
import {getRootDir} from './src/build/get_root_dir.mjs';

/**
 * @description returns a list of all valid actions to run
 */
export async function main() {
  const {scripts} = JSON.parse(await fs.readFile(path.join(getRootDir(), 'package.json')));

  for (const script in scripts) {
    console.info(script);
  }

  for (const actionPath of await globby.default(['**/*.action.sh', '**/*.action.mjs'])) {
    console.info(actionPath.match(/(.+)\.action/)[1]);
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
