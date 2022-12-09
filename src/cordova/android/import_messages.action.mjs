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

import url from 'url';
import {getRootDir} from '../../build/get_root_dir.mjs';
import {readFile, readdir, writeFile, mkdir, access} from 'fs/promises';
import {getNativeAndroidMessageDirectory} from './get_native_android_message_directory.mjs';
import XML from 'xmlbuilder2';

export async function main() {
  const root = `${getRootDir()}/www/messages`;
  const files = await readdir(root);

  for (const filename of files) {
    const filepath = `${root}/${filename}`;
    const messageData = JSON.parse(await readFile(filepath, 'utf8'));
    const xmlStrings = [
      {
        '@name': 'app_name',
        '#text': 'Outline',
      },
      {
        '@name': 'launcher_name',
        '#text': '@string/app_name',
      },
      {
        '@name': 'activity_name',
        '#text': '@string/launcher_name',
      },
    ];

    for (const messageId in messageData) {
      xmlStrings.push({
        '@name': messageId.replaceAll('-', '_'),
        '#text': messageData[messageId],
      });
    }

    const androidDirectory = getNativeAndroidMessageDirectory(filepath);

    try {
      await access(androidDirectory);
    } catch (e) {
      await mkdir(androidDirectory);
    }

    await writeFile(
      `${getNativeAndroidMessageDirectory(filepath)}/strings.xml`,
      XML.create({
        resources: {string: xmlStrings},
      }).end({prettyPrint: true})
    );
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main();
}
