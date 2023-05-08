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

import JSZip from 'jszip';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Unzip a zip file to a target directory.
 * @param {string} zipPath The full path of the zip file.
 * @param {string} targetDirectory The full path of the target directory.
 * @returns {Promise<void>} A task that will be completed once the unzip is complete.
 */
export async function unzipFile(zipPath, targetDirectory) {
  console.log(zipPath, targetDirectory);

  return Promise.all(
    Object.values((await new JSZip().loadAsync(zipPath)).files).map(async file => {
      const targetPath = path.resolve(targetDirectory, file.name);

      if (file.dir) {
        return fs.mkdir(targetPath);
      }

      return fs.writeFile(targetPath, Buffer.from(await file.async('nodebuffer')));
    })
  );
}
