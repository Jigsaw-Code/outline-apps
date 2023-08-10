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

import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

/**
 * Read and calculate the checksum of file located in `filepath` using the
 * specific hashing `algorithm`.
 * @param {string} filepath The full path of the file to be read.
 * @param {'sha256'|'sha512'} algorithm The hashing algorithm supported by node.
 * @returns {Promise<string?>} The checksum represented in hex string with lower
 *                             case letters (e.g. `123acf`); or `null` if any
 *                             errors are thrown (such as file not readable).
 */
export async function getFileChecksum(filepath, algorithm) {
  if (!filepath || !algorithm) {
    throw new Error('filepath and algorithm are required');
  }
  try {
    const buffer = await readFile(filepath);
    const hasher = createHash(algorithm);
    hasher.update(buffer);
    return hasher.digest('hex');
  } catch {
    return null;
  }
}
