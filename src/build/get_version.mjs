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

import {parseXmlFile} from './parse_xml_file.mjs';

/*
  Inputs:
  => platform: the platform to get the current version for

  Outputs:
  => the MAJOR.MINOR.PATCH formatted version number for the given platform
*/
export async function getVersion(platform) {
  switch (platform) {
    case 'android':
    case 'browser': {
      const {widget} = await parseXmlFile('config.xml');
      return widget.$.version;
    }
    case 'ios':
    case 'macos': {
      const {
        plist: {
          dict: [{key: plistKeys, string: plistValues}],
        },
      } = await parseXmlFile(`src/cordova/apple/xcode/${platform}/Outline/Outline-Info.plist`);
      return plistValues[plistKeys.indexOf('CFBundleShortVersionString')];
    }
    case 'windows':
      return '1.10.1';
    case 'linux':
      return '1.10.1';
    default:
      throw new Error('get_version must be provided a platform argument');
  }
}
