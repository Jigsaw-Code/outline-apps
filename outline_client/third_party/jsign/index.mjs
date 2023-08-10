// Copyright 2023 The Outline Authors
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

import {spawn} from 'node:child_process';
import {resolve} from 'node:path';

import {downloadHttpsFile} from '../../src/build/download_file.mjs';
import {getFileChecksum} from '../../src/build/get_file_checksum.mjs';
import {getRootDir} from '../../src/build/get_root_dir.mjs';

/**
 * Run jsign.jar to sign `fileToSign` with a list of cli arguments stored in `options`.
 * @param {string} fileToSign The path string of a file to be signed.
 * @param {string[]} options A list of cli arguments to be passed to jsign. see https://ebourg.github.io/jsign/
 * @returns {Promise<number>} A promise containing the exit code of jsign.
 */
export async function jsign(fileToSign, options) {
  if (!fileToSign) {
    throw new Error('fileToSign is required by jsign');
  }
  if (!options) {
    throw new Error('options are required by jsign');
  }

  const jsignJarPath = await ensureJsignJar();
  const jsignProc = spawn('java', ['-jar', jsignJarPath, ...options, fileToSign], {
    stdio: 'inherit',
  });
  return await new Promise((resolve, reject) => {
    jsignProc.on('error', reject);
    jsignProc.on('exit', resolve);
  });
}


const JSIGN_FILE_NAME = 'jsign-4.2.jar';
const JSIGN_DOWNLOAD_URL = 'https://github.com/ebourg/jsign/releases/download/4.2/jsign-4.2.jar';
const JSIGN_SHA256_CHECKSUM = '290377fc4f593256200b3ea4061b7409e8276255f449d4c6de7833faf0850cc1';

/**
 * Ensure jsign.jar exists and return the absolute path to it.
 */
async function ensureJsignJar() {
  const jsignPath = resolve(getRootDir(), 'third_party', 'jsign', JSIGN_FILE_NAME);
  if ((await getFileChecksum(jsignPath, 'sha256')) === JSIGN_SHA256_CHECKSUM) {
    return jsignPath;
  }

  console.debug(`downloading jsign from "${JSIGN_DOWNLOAD_URL}" to "${jsignPath}"`);
  await downloadHttpsFile(JSIGN_DOWNLOAD_URL, jsignPath);

  const actualChecksum = await getFileChecksum(jsignPath, 'sha256');
  if (actualChecksum !== JSIGN_SHA256_CHECKSUM) {
    throw new Error(`failed to verify "${jsignPath}". ` +
      `Expected checksum ${JSIGN_SHA256_CHECKSUM}, but found ${actualChecksum}`);
  }

  console.debug(`successfully downloaded "${jsignPath}"`);
  return jsignPath;
}
