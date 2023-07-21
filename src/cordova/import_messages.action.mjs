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

import chalk from 'chalk';
import path from 'path';
import rmfr from 'rmfr';
import url from 'url';
import {getRootDir} from '../build/get_root_dir.mjs';
import {readFile, readdir, writeFile, mkdir} from 'fs/promises';
import {getNativeLocale as getNativeAndroidLocale} from './android/get_native_locale.mjs';
import XML from 'xmlbuilder2';

const ANDROID_STRINGS_DIR = 'src/cordova/plugin/android/resources/strings/';
const ANDROID_STRINGS_FILENAME = 'strings.xml';
const ANDROID_XML_STRING_ID_PROPERTY = '@name';
const ANDROID_XML_TEXT_CONTENT = '#';

export async function main() {
  const outputDir = path.join(getRootDir(), ANDROID_STRINGS_DIR);
  const requiredAndroidStrings = XML.create(
    await readFile(path.join(outputDir, 'values', ANDROID_STRINGS_FILENAME), 'utf8')
  ).end({format: 'object'}).resources.string;

  // Clear all existing locales first, so languages we stop supporting get
  // cleared.
  await rmfr(path.join(outputDir, 'values-*'), {glob: true});

  console.group(chalk.white(`▶ importing Android messages:`));

  const messagesDir = path.join(getRootDir(), 'www/messages');
  for (const messagesFilename of await readdir(messagesDir)) {
    const polymerLang = path.basename(messagesFilename, path.extname(messagesFilename));
    console.log(chalk.gray(`Importing \`${polymerLang}\``));

    const androidLocale = getNativeAndroidLocale(polymerLang);
    const localeDir = path.join(outputDir, `values-${androidLocale}`);

    const messagesFilepath = path.join(messagesDir, messagesFilename);
    const messageData = JSON.parse(await readFile(messagesFilepath, 'utf8'));

    const androidStrings = [];
    for (const requiredString of requiredAndroidStrings) {
      const messageId = requiredString[ANDROID_XML_STRING_ID_PROPERTY].replaceAll('_', '-');
      const fallbackContent = requiredString[ANDROID_XML_TEXT_CONTENT];

      androidStrings.push({
        [ANDROID_XML_STRING_ID_PROPERTY]: requiredString[ANDROID_XML_STRING_ID_PROPERTY],
        [ANDROID_XML_TEXT_CONTENT]: messageData[messageId] ?? fallbackContent,
      });
    }

    const outputPath = path.join(localeDir, ANDROID_STRINGS_FILENAME);
    console.log(chalk.gray(`Writing ${androidStrings.length} messages to ` + `\`${outputPath}\``));
    await mkdir(localeDir, {recursive: true});
    await writeFile(
      outputPath,
      XML.create({encoding: 'UTF-8'}, {resources: {string: androidStrings}}).end({prettyPrint: true})
    );
  }
  console.groupEnd();
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main();
}
