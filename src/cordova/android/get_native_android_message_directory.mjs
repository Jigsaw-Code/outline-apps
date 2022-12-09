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
  let [languageCode] = filepath
    .split('/')
    .at(-1)
    .split('.');

  switch (languageCode) {
    case 'es-419':
      languageCode = 'es';
      break;
    case 'sr-Latn':
      languageCode = 'b+sr+Latn';
      break;
    case 'zh-CN':
      languageCode = 'zh-rCN';
      break;
    case 'zh-TW':
      languageCode = 'zh-rTW';
      break;
    case 'pt-BR':
      languageCode = 'pt-rBR';
      break;
    case 'pt-PT':
      languageCode = 'pt-rPT';
      break;
  }

  return `src/cordova/plugin/android/resources/strings/values-${languageCode}`;
};
