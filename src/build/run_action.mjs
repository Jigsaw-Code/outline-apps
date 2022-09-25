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

import chalk from 'chalk';
import {existsSync} from 'fs';
import fs from 'fs/promises';
import path from 'path';
import url from 'url';

import {getRootDir} from './get_root_dir.mjs';
import {spawnStream} from './spawn_stream.mjs';

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
class ActionCache {
  ACTION_CACHE_FILE = './.action_cache.json';

  constructor() {
    this.cachePath = path.resolve(process.env.ROOT_DIR, this.ACTION_CACHE_FILE);
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

/**
 * @description This is the entrypoint into our custom task runner.
 * It runs an `*.action.mjs` or `*.action.sh` file with the given parameters.
 * You can find these files located within their associated directories in the project.
 *
 * @param {string} actionPath The truncated path to the action you wish to run (e.g. "www/build")
 * @param {Object} options Additional action options
 * @param {string[]} options.parameters Command line arguments passed in to the action script
 * @param {string[]} options.inputs Files and folders the action consumes. Specify these to skip the action when able
 * @returns {void}
 */
export async function runAction(actionPath, {parameters = [], inputs = []} = {}) {
  let resolvedPath;
  const pathRoots = [process.env.ROOT_DIR, path.join(process.env.ROOT_DIR, 'src')];
  const fileExtensions = ['sh', 'mjs'];

  for (const root of pathRoots) {
    for (const extension of fileExtensions) {
      const pathCandidate = `${path.resolve(root, actionPath)}.action.${extension}`;

      if (existsSync(pathCandidate)) {
        resolvedPath = pathCandidate;
        break;
      }
    }
  }

  if (!resolvedPath) {
    console.info(chalk.red(`Could not find an action at path:`), chalk.red.bold(`"${actionPath}"`));
    console.info();
    console.info(chalk.yellow.bold('Please provide a valid action to run.'));
    console.info();
    console.info(
      chalk.white.underline('The'),
      chalk.white.bold.underline('list'),
      chalk.white.underline('of valid actions are as follows:')
    );
    console.info();

    return runAction('list');
  }

  const cache = new ActionCache();

  const actionOptions = {parameters, inputs};
  const lastRunMetadata = await cache.read(resolvedPath, actionOptions);

  if (inputs.length) {
    for (const input of inputs) {
      if (!existsSync(input)) {
        throw new ReferenceError(`action(${actionPath}) requires the input: "${input}". Aborting!`);
      }
    }

    let mostRecentlyModifiedInput = 0;
    let inputsToCheck = [...inputs];
    while (inputsToCheck.length) {
      const currentFolderOrFile = inputsToCheck.pop();
      const fileInformation = await fs.stat(currentFolderOrFile);

      mostRecentlyModifiedInput = Math.max(mostRecentlyModifiedInput, fileInformation.mtimeMs);

      if (fileInformation.isDirectory()) {
        const contents = await fs.readdir(currentFolderOrFile);

        inputsToCheck.push(...contents.map(child => `${currentFolderOrFile}/${child}`));
      }
    }

    if (lastRunMetadata.timestamp > mostRecentlyModifiedInput) {
      console.info(
        chalk.bold(`Skipping action(${actionPath}):`),
        'No source file from the given inputs',
        chalk.blue(`"${inputs.join(', ')}"`),
        'are newer than the previous successful run of this action.'
      );

      return;
    }
  }

  let runner = 'npm run';

  if (resolvedPath.endsWith('mjs')) {
    runner = 'node --trace-uncaught';
  }

  if (resolvedPath.endsWith('sh')) {
    runner = 'bash';
  }

  console.group(chalk.yellow.bold(`▶ action(${actionPath}):`));
  const startTime = performance.now();

  try {
    await spawnStream(runner, [resolvedPath, ...parameters]);
    await cache.update(resolvedPath, {
      options: actionOptions,
      timestamp: Date.now(),
    });
  } catch (error) {
    if (error?.message) {
      console.error(chalk.red(error.message));
    }
    console.groupEnd();
    console.error(chalk.red.bold(`▶ action(${actionPath}):`), chalk.red(`❌ Failed.`));

    process.exit(1);
  }

  console.groupEnd();
  console.info(
    chalk.green.bold(`▶ action(${actionPath}):`),
    chalk.green(`🎉 Success!`, chalk.italic.gray(`(${Math.floor(performance.now() - startTime)}ms)`))
  );
}

async function main() {
  process.env.ROOT_DIR ??= getRootDir();
  process.env.BUILD_DIR ??= path.join(process.env.ROOT_DIR, 'build');
  process.env.FORCE_COLOR = true;

  if (!process.env.IS_ACTION) {
    console.info(
      chalk.bgGreen.bold(`
       / __ \\| |  | |__   __| |    |_   _| \\ | |  ____|    
      | |  | | |  | |  | |  | |      | | |  \\| | |__       
      | |  | | |  | |  | |  | |      | | | . \` |  __|      
      | |__| | |__| |  | |  | |____ _| |_| |\\  | |____     
       \\____/ \\____/   |_|  |______|_____|_| \\_|______|    `)
    );
    console.info(
      chalk.gray(`
  =========================================================
               © The Outline Authors, 2022
  =========================================================
  `)
    );

    process.env.IS_ACTION = true;
  }

  return runAction(process.argv[2], {parameters: process.argv.slice(3)});
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main();
}
