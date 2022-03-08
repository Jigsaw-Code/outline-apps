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

import {spawn} from 'child_process';
import {resolve} from 'path';

/**
 * Get the full path of jsign.jar.
 * @returns {string} The full path similar to <.../jsign.jar>.
 */
function getJsignJarPath() {
  return resolve('third_party', 'jsign', 'jsign-4.0.jar');
}

/**
 * Run jsign.jar according to the corresponding options targeting fileToSign.
 * @param {string} fileToSign The path string of a file to be signed.
 * @param {string[]} options The options to be passed to jsign. see https://ebourg.github.io/jsign/
 * @returns {Promise<number>} A promise containing the exit code of jsign.
 */
export default async function jsign(fileToSign, options) {
  if (!options) {
    throw new Error('options are required by jsign');
  }
  if (!fileToSign) {
    throw new Error('fileToSign is required by jsign');
  }

  const jsignProc = spawn(
      'java',
      [
        '-jar', getJsignJarPath(),
        ...options,
        fileToSign,
      ],
      {
        stdio: 'inherit',
      });
  return await new Promise(resolve => jsignProc.on('exit', resolve));
}
