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

import {createWriteStream} from 'node:fs';
import {default as redir} from 'follow-redirects';

/**
 * Download a remote file from `fileUrl` and save it to `filepath`, using HTTPS protocol.
 * This function will also follow HTTP redirects.
 * @param {string} fileUrl The full URL of the remote resource.
 * @param {string} filepath The full path of the target file.
 * @returns {Promise<void>} A task that will be completed once the download is completed.
 */
export async function downloadHttpsFile(fileUrl, filepath) {
  return new Promise((resolve, reject) => {
    redir.https
      .get(fileUrl, response => {
        if (response.statusCode !== 200) {
          reject(new Error(`failed to download "${fileUrl}": ${response.statusCode} ${response.statusMessage}`));
        } else {
          const target = createWriteStream(filepath)
            .once('finish', resolve)
            .once('error', reject);
          response.once('error', reject).pipe(target);
        }
      })
      .on('error', reject);
  });
}
