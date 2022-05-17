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
 * @description promisifies the child process (for supporting legacy bash actions!)
 */
const spawnStream = (command, parameters) =>
  new Promise((resolve, reject) => {
    const childProcess = spawn(command, parameters, {shell: true});

    const forEachMessageLine = (buffer, callback) => {
      buffer
        .toString()
        .split('\n')
        .filter(line => line.trim())
        .forEach(callback);
    };

    childProcess.stdout.on('data', data => forEachMessageLine(data, line => console.info(line)));
    childProcess.stderr.on('data', error => forEachMessageLine(error, line => console.error(chalk.red(line))));

    childProcess.on('close', code => {
      if (code === 0) {
        resolve(childProcess);
      } else {
        reject(childProcess);
      }
    });
  });

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
export async function runAction(actionPath, ...parameters) {
  const resolvedPath = await resolveActionPath(actionPath);
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

  console.group(chalk.yellow.bold(`▶ action(${actionPath}):`));
  const startTime = performance.now();

  try {
    await spawnStream(resolvedPath.endsWith('mjs') ? 'node' : 'bash', [resolvedPath, ...parameters]);
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

  return runAction(...process.argv.slice(2));
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main();
}
