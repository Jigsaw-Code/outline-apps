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
import {spawn} from 'child_process';

/**
 * @description promisifies the child process (for supporting legacy bash actions!)
 */
export const spawnStream = (command, ...parameters) =>
  new Promise((resolve, reject) => {
    const stdout = [];
    const stderr = [];

    console.debug(`Running [${[command, ...parameters.map(e => `'${e}'`)].join(' ')}]`);
    const childProcess = spawn(command, parameters, {env: process.env});

    const forEachMessageLine = (buffer, callback) => {
      buffer
        .toString()
        .split('\n')
        .filter(line => line.trim())
        .forEach(callback);
    };

    childProcess.stdout.on('data', data =>
      forEachMessageLine(data, line => {
        console.info(line);
        stdout.push(line);
      })
    );

    childProcess.stderr.on('data', error => forEachMessageLine(error, line => stderr.push(line)));

    childProcess.on('close', code => {
      if (code === 0) {
        return resolve(stdout.join(''));
      }
      console.error(
        chalk.red(
          `ERROR(spawn_stream): ${chalk.underline(
            [command, ...parameters].join(' ')
          )} failed with exit code ${chalk.bold(code)}. Printing stderr:`
        )
      );
      stderr.forEach(error => console.error(chalk.rgb(128, 64, 64)(error)));
      return reject(code);
    });
  });
