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

import {existsSync} from 'fs';
import fs from 'fs/promises';
import path from 'path';

const ACTION_CACHE_FILE = './.action_cache.json';

/**
 * @description The "Action Cache" is a simple JSON file we use to track previous action runs and determine
 * if they can be skipped on subsequent attempts.
 *
 * Cache methods:
 *   read - loads the latest time the action was run along with the parameters it was run with
 *   update - updates the time an action was run and the parameters it was run with
 *
 * TODO(daniellacosse): convert the cache to a folder so each actions can run in parallel without risking
 * corruption of the cache
 */
export class ActionCache {
  constructor() {
    this.cachePath = path.resolve(process.env.ROOT_DIR, ACTION_CACHE_FILE);
  }

  async read(actionPathKey, actionOptions) {
    if (!existsSync(this.cachePath)) {
      await fs.writeFile(this.cachePath, '{}');
    }

    const cache = JSON.parse(await fs.readFile(this.cachePath));

    if (JSON.stringify(cache[actionPathKey]?.options) !== JSON.stringify(actionOptions)) {
      return {};
    }

    return cache[actionPathKey];
  }

  async update(actionPathKey, actionCacheObject) {
    let cache = {};

    if (existsSync(this.cachePath)) {
      cache = JSON.parse(await fs.readFile(this.cachePath));
    }

    cache[actionPathKey] = actionCacheObject;

    return fs.writeFile(this.cachePath, JSON.stringify(cache));
  }
}
