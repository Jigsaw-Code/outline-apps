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

const ANDROID_XML_STRING_ID_PROPERTY = '@name';
const ANDROID_XML_TEXT_CONTENT = '#';

export async function main() {
  const requiredAndroidStrings = XML.create(
    await readFile(`${getRootDir()}/src/cordova/plugin/android/resources/strings/values/strings.xml`, 'utf8')
  ).end({format: 'object'}).resources.string;

  const messagesDirectory = `${getRootDir()}/www/messages`;
  for (const messagesFilename of await readdir(messagesDirectory)) {
    const messagesFilepath = `${messagesDirectory}/${messagesFilename}`;
    const messageData = JSON.parse(await readFile(messagesFilepath, 'utf8'));

    let androidStrings = [];
    for (const requiredStringObject of requiredAndroidStrings) {
      const messageId = requiredStringObject[ANDROID_XML_STRING_ID_PROPERTY].replaceAll('_', '-');

      androidStrings.push({
        [ANDROID_XML_STRING_ID_PROPERTY]: requiredStringObject[ANDROID_XML_STRING_ID_PROPERTY],
        [ANDROID_XML_TEXT_CONTENT]: messageData[messageId] ?? requiredStringObject[ANDROID_XML_TEXT_CONTENT],
      });
    }

    const androidDirectory = getNativeAndroidMessageDirectory(messagesFilepath);

    try {
      await access(androidDirectory);
    } catch (e) {
      await mkdir(androidDirectory);
    }

    await writeFile(
      `${getNativeAndroidMessageDirectory(messagesFilepath)}/strings.xml`,
      XML.create({
        resources: {string: androidStrings},
      }).end({prettyPrint: true})
    );
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main();
}
