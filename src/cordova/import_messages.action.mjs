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
import minimist from 'minimist';
import path from 'path';
import rmfr from 'rmfr';
import url from 'url';
import {getRootDir} from '../build/get_root_dir.mjs';
import {readFile, readdir, writeFile, mkdir} from 'fs/promises';
import {getNativeLocale as getNativeAndroidLocale} from './android/get_native_locale.mjs';
import XML from 'xmlbuilder2';
import I18N from 'i18n-strings-files';

const ANDROID = 'android';
const IOS = 'ios';
const VALID_PLATFORMS = [ANDROID, IOS];

const SOURCE_MESSAGES_DIR = 'www/messages';

const ANDROID_STRINGS_DIR = 'src/cordova/plugin/android/resources/strings/';
const ANDROID_STRINGS_FILENAME = 'strings.xml';
const ANDROID_XML_STRING_ID_PROPERTY = '@name';
const ANDROID_XML_TEXT_CONTENT = '#';

const IOS_STRINGS_DIR = 'src/cordova/apple/xcode/ios/Outline/Resources/';
const IOS_STRINGS_FILENAME = 'Localizable.strings';

function escapeXmlCharacters(str) {
  return str
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>;')
    .replace(/&/g, '\\&');
}

/*
  Inputs:
  => cliParameters: the list of action arguments passed in

  Outputs:
  => an object containing the specificed platform and buildMode.
*/
export function getBuildParameters(cliArguments) {
  console.log(minimist(cliArguments));
  const {
    _: [platform = ''],
  } = minimist(cliArguments);

  if (!VALID_PLATFORMS.includes(platform)) {
    throw new TypeError(
      `Platform "${platform}" is not a valid target for importing messages. ` +
        `Must be one of "${VALID_PLATFORMS.join('", "')}"`
    );
  }

  return {platform};
}

async function importAndroidMessages() {
  const outputDir = path.join(getRootDir(), ANDROID_STRINGS_DIR);
  const requiredStrings = XML.create(
    await readFile(path.join(outputDir, 'values', ANDROID_STRINGS_FILENAME), 'utf8')
  ).end({format: 'object'}).resources.string;

  // Clear all existing locales first, so languages we stop supporting get
  // cleared.
  await rmfr(path.join(outputDir, 'values-*'), {glob: true});

  const messagesDir = path.join(getRootDir(), SOURCE_MESSAGES_DIR);
  for (const messagesFilename of await readdir(messagesDir)) {
    const polymerLang = path.basename(messagesFilename, path.extname(messagesFilename));
    console.log(chalk.gray(`Importing \`${polymerLang}\``));

    const androidLocale = getNativeAndroidLocale(polymerLang);
    const localeDir = path.join(outputDir, `values-${androidLocale}`);

    const messagesFilepath = path.join(messagesDir, messagesFilename);
    const messageData = JSON.parse(await readFile(messagesFilepath, 'utf8'));

    const outputStrings = [];
    for (const requiredString of requiredStrings) {
      const messageId = requiredString[ANDROID_XML_STRING_ID_PROPERTY].replaceAll('_', '-');
      const fallbackContent = requiredString[ANDROID_XML_TEXT_CONTENT];

      outputStrings.push({
        [ANDROID_XML_STRING_ID_PROPERTY]: requiredString[ANDROID_XML_STRING_ID_PROPERTY],
        [ANDROID_XML_TEXT_CONTENT]: escapeXmlCharacters(messageData[messageId] ?? fallbackContent),
      });
    }

    const outputPath = path.join(localeDir, ANDROID_STRINGS_FILENAME);
    console.log(chalk.gray(`Writing ${outputStrings.length} messages to \`${outputPath}\``));
    await mkdir(localeDir, {recursive: true});
    await writeFile(
      outputPath,
      XML.create({encoding: 'UTF-8'}, {resources: {string: outputStrings}}).end({prettyPrint: true, wellFormed: true})
    );
  }
}

async function importIosMessages() {
  const outputDir = path.join(getRootDir(), IOS_STRINGS_DIR);
  const requiredStrings = I18N.readFileSync(path.join(outputDir, 'en.lproj', IOS_STRINGS_FILENAME), {
    encoding: 'UTF-8',
  });

  // Clear all existing locales first, so languages we stop supporting get
  // cleared.
  await rmfr(path.join(outputDir, '*.lproj'));

  const messagesDir = path.join(getRootDir(), SOURCE_MESSAGES_DIR);
  for (const messagesFilename of await readdir(messagesDir)) {
    const polymerLang = path.basename(messagesFilename, path.extname(messagesFilename));
    console.log(chalk.gray(`Importing \`${polymerLang}\``));

    const iosLocale = polymerLang;
    const localeDir = path.join(outputDir, `${iosLocale}.lproj`);

    const messagesFilepath = path.join(messagesDir, messagesFilename);
    const messageData = JSON.parse(await readFile(messagesFilepath, 'utf8'));

    const outputStrings = {};
    for (const [key, value] of Object.entries(requiredStrings)) {
      const messageId = key.replaceAll('_', '-');
      const fallbackContent = value;

      outputStrings[key] = messageData[messageId] ?? fallbackContent;
    }
    const outputPath = path.join(localeDir, IOS_STRINGS_FILENAME);
    console.log(chalk.gray(`Writing ${Object.values(outputStrings).length} messages to \`${outputPath}\``));
    await mkdir(localeDir, {recursive: true});
    I18N.writeFileSync(outputPath, outputStrings, {encoding: 'UTF-8'});
  }
}

async function main(...parameters) {
  const {platform} = getBuildParameters(parameters);
  console.group(chalk.white(`▶ importing ${platform} messages:`));

  switch (platform) {
    case ANDROID:
      await importAndroidMessages();
      break;
    case IOS:
      await importIosMessages();
      break;
    default:
      throw new Error(`Message import not implemented for platform "${platform}"`);
  }

  console.groupEnd();
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
