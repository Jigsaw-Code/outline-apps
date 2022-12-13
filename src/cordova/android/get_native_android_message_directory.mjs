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

export const getNativeAndroidMessageDirectory = filepath => {
  let [polymerLanguageFilename] = filepath
    .split('/')
    .at(-1)
    .split('.');

  switch (polymerLanguageFilename) {
    case 'es-419':
      return 'src/cordova/plugin/android/resources/strings/values-es';
    case 'sr-Latn':
      return 'src/cordova/plugin/android/resources/strings/values-b+sr+Latn';
    case 'zh-CN':
      return 'src/cordova/plugin/android/resources/strings/values-zh-rCN';
    case 'zh-TW':
      return 'src/cordova/plugin/android/resources/strings/values-zh-rTW';
    case 'pt-BR':
      return 'src/cordova/plugin/android/resources/strings/values-pt-rBR';
    case 'pt-PT':
      return 'src/cordova/plugin/android/resources/strings/values-pt-rPT';
    default:
      return `src/cordova/plugin/android/resources/strings/values-${polymerLanguageFilename}`;
  }
};
