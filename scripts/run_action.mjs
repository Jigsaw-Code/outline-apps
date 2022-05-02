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
import path from 'path';
import {spawn} from 'child_process';
import url from 'url';

import {getRootDir} from './get_root_dir.mjs';

/**
 * @description This is the entrypoint into our custom task runner.
 * It runs an `*.action.mjs` or `*.action.sh` file with the given parameters.
 * You can find these files located within their associated directories in the project.
 * Action files can also define:
 *   `requirements` - actions that must be run beforehand as prerequisite.
 *   `dependencies` - files and folders that the action takes as input. If they remain unchanged, the action can be skipped.
 *
 * @param {string} actionPath The truncated path to the action you wish to run (e.g. "www/build")
 * @param {...string} parameters The flags and other parameters we want to run the action with.
 * @returns {void}
 */
export async function runAction(actionPath, {parameters = [], inputs = []}) {
  /**
   * The "Action Cache" is a simple JSON file we use to track previous action runs and determine
   * if they can be skipped on subsequent attempts.
   *
   * Cache methods:
   *   readActionCache - loads the latest time the action was run along with the parameters it was run with
   *   writeActionCache - updates the time an action was run and the parameters it was run with
   *
   * TODO(daniellacosse): convert the cache to a folder so each actions can run in parallel without risking
   * corruption of the cache
   */
  const ACTION_CACHE_FILE = './.action_cache.json';

  const readActionCache = async (actionPathKey, parameters) => {
    const cachePath = path.resolve(process.env.ROOT_DIR, ACTION_CACHE_FILE);

    if (!existsSync(cachePath)) {
      return {};
    }

    const cache = JSON.parse(await fs.readFile(cachePath));

    if (JSON.stringify(cache[actionPathKey]?.parameters) !== JSON.stringify(parameters)) {
      return {};
    }

    return cache[actionPathKey];
  };

  const writeActionCache = async (actionPathKey, actionCacheObject) => {
    const cachePath = path.resolve(process.env.ROOT_DIR, ACTION_CACHE_FILE);

    let cache = {};

    if (existsSync(cachePath)) {
      cache = JSON.parse(await fs.readFile(cachePath));
    }

    cache[actionPathKey] = actionCacheObject;

    await fs.writeFile(cachePath, JSON.stringify(cache));
  };

  /**
   * @description BFSes a list of file system targets, returning the timestamp of the most
   * recently modified one.
   *
   * @param {Array<Directory | File>} inputs List of folders and files to scan.
   * @returns {number} Timestamp in milliseconds of the most recently modified file.
   */
  const mostRecentModification = async inputs => {
    let result = 0;
    let foldersAndFiles = [...inputs];

    while (foldersAndFiles.length) {
      const currentFolderOrFile = foldersAndFiles.pop();
      const fileInformation = await fs.stat(currentFolderOrFile);

      result = Math.max(result, fileInformation.mtimeMs);

      if (fileInformation.isDirectory()) {
        const contents = await fs.readdir(currentFolderOrFile);

        foldersAndFiles = [...foldersAndFiles, ...contents.map(child => `${currentFolderOrFile}/${child}`)];
      }
    }

    return result;
  };

  /**
   * @description loads the absolute path of the action file
   */
  const resolveActionPath = async actionPath => {
    if (!actionPath) return '';

    const roots = [process.env.ROOT_DIR, path.join(process.env.ROOT_DIR, 'src')];
    const extensions = ['sh', 'mjs'];

    for (const root of roots) {
      for (const extension of extensions) {
        const pathCandidate = `${path.resolve(root, actionPath)}.action.${extension}`;

        if (existsSync(pathCandidate)) {
          return pathCandidate;
        }
      }
    }
  };

  /**
   * @description promisifies the child process spawner
   */
  const spawnPromise = (command, parameters) =>
    new Promise((resolve, reject) => {
      const childProcess = spawn(command, parameters, {shell: true});

      childProcess.stdout.on('data', data => console.info(data.toString()));
      childProcess.stderr.on('data', error => console.error(chalk.red(error.toString())));

      childProcess.on('close', code => {
        if (code === 0) {
          resolve(childProcess);
        } else {
          reject(childProcess);
        }
      });
    });

  const resolvedPath = await resolveActionPath(actionPath);
  if (!resolvedPath) {
    console.info('Please provide an action to run.');
    return runAction('list');
  }

  const actionCache = await readActionCache(resolvedPath, parameters);

  console.group(chalk.yellow.bold(`▶ action(${actionPath}):`));
  const startTime = performance.now();

  try {
    if (actionCache.lastRan > (await mostRecentModification(inputs))) {
      console.info(
        chalk.bold(`Skipping:`),
        'No source file from the given inputs',
        chalk.blue(`"${inputs.join(', ')}"`),
        'are newer than the previous successful run of this action.'
      );
    } else {
      await spawnPromise(resolvedPath.endsWith('mjs') ? 'node' : 'bash', [resolvedPath, ...parameters]);

      await writeActionCache(resolvedPath, {
        parameters,
        lastRan: Date.now(),
      });
    }
  } catch (error) {
    console.error(error);
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

  return runAction(...process.argv.slice(2));
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main();
}
