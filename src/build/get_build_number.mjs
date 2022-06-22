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

import xml2js from 'xml2js';
import fs from 'fs/promises';

/*
  Inputs:
  => platform: the platform to get the build number for

  Outputs:
  => the build number for the given platform. Does nothing if not applicable.
*/
export async function getBuildNumber(platform) {
  // xmljs can parse both plist and xml files
  const parseFile = async filePath => await xml2js.parseStringPromise(await fs.readFile(filePath));
  switch (platform) {
    case 'android':
    case 'browser': {
      const {widget} = await parseFile('config.xml');
      return widget.$['android-versionCode'];
    }
    case 'ios':
    case 'macos': {
      const {
        plist: {
          dict: [{key: plistKeys, string: plistValues}],
        },
      } = await parseFile(`src/cordova/apple/xcode/${platform}/Outline/Outline-Info.plist`);
      return plistValues[plistKeys.indexOf('CFBundleVersion')];
    }
    case 'windows':
    case 'linux':
    default:
      return;
  }
}
