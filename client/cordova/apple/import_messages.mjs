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

import path from 'path';
import I18N from 'i18n-strings-files';

const STRINGS_DIR = ['src', 'cordova', 'apple', 'OutlineAppleLib', 'Sources', 'OutlineAppKitBridge', 'Resources', 'Strings'];
const STRINGS_FILENAME = 'Localizable.strings';

function getNativeLocale(locale) {
  switch (locale) {
    case 'zh-CN':
      return 'zh-Hans';
    case 'zh-TW':
      return 'zh-Hant';
    default:
      return locale;
  }
}

/**
 * Retrieves a filepath for a given locale to read/write strings to.
 * @param {string} locale A locale for which to get a strings filepath.
 * @returns {string} The filepath.
 */
export function getStringsFilepath(locale) {
  return path.join(...STRINGS_DIR, `${getNativeLocale(locale)}.lproj`, STRINGS_FILENAME);
}

/**
 * Reads messages that require translations.
 * @return {Map<string, string>} messages The messages to translate.
 */
export async function readMessages() {
  const messages = I18N.readFileSync(getStringsFilepath('en'), {encoding: 'UTF-8'});
  return new Map(Object.entries(messages));
}

/**
 * Writes output messages to a given path in the Apple expected format.
 * @param {string} path The path to write the messages to.
 * @param {Map<string, string>} messages The messages to write.
 */
export async function writeMessages(path, messages) {
  I18N.writeFileSync(path, messages, {encoding: 'UTF-8'});
}
