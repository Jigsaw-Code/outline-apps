// Copyright 2025 The Outline Authors
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

import fs from 'fs/promises';
import path from 'path';
import {spawnStream} from '@outline/infrastructure/build/spawn_stream.mjs';
import {getRootDir} from '@outline/infrastructure/build/get_root_dir.mjs';

const root = getRootDir();
const clientRoot = path.resolve(root, 'client');
const capRoot = path.resolve(root, 'client', 'capacitor');
const www = path.join(clientRoot, 'www');
const exists = p => fs.access(p).then(() => true, () => false);

// 1) Always build web assets
await spawnStream('npm', 'run', 'action', 'client/src/www/build');

// 2) Ensure index.html (fallback to index_cordova.html)
const idx = path.join(www, 'index.html');
const idxCord = path.join(www, 'index_cordova.html');
if (!(await exists(idx)) && (await exists(idxCord))) {
  await fs.copyFile(idxCord, idx);
}

// 3) Generate icons/splashes, then sync (run from Capacitor root)
process.chdir(capRoot);
await spawnStream('npx', 'capacitor-assets', 'generate');
await spawnStream('npx', 'cap', 'sync');
