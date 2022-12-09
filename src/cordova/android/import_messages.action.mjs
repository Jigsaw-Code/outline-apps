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

import {getRootDir} from '../../build/get_root_dir.mjs';
import {readFile, readdir, writeFile} from 'fs/promises';
import {getNativeAndroidMessageDirectory} from './get_native_android_message_directory.mjs';
import XML from 'xmlbuilder2';

export async function main() {
  const files = await readdir(`${getRootDir()}/www/messages`);

  for (const filepath of files) {
    const xmlStrings = [];
    for (const messageId in JSON.parse(await readFile(filepath, 'utf8'))) {
      xmlStrings.push({
        '@name': messageId.replaceAll('-', '_'),
      });
    }

    await writeFile(
      `${getNativeAndroidMessageDirectory(filepath)}/strings.xml`,
      XML.create({
        resources: {string: xmlStrings},
      }).end()
    );
  }
}
