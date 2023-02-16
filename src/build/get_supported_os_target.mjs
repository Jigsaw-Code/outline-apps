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
  => platform: the platform we have a baseline level of support for

  Outputs:
  => number representing the lowest version of that platform we support
*/
export async function getSupportedOSTarget(platform) {
  // xmljs can parse both plist and xml files
  const parseFile = async filePath => await xml2js.parseStringPromise(await fs.readFile(filePath));
  switch (platform) {
    case 'android': {
      const {
        widget: {preference: preferenceList},
      } = await parseFile('config.xml');
      const androidAPITargetXMLTag = preferenceList.find(({$}) => $.name === 'android-minSdkVersion');

      return Number(androidAPITargetXMLTag.$.value);
    }
    case 'ios': {
      const {
        widget: {platform: platformList},
      } = await parseFile('config.xml');

      const iosDeploymentTargetXMLTag = platformList
        .find(({$}) => $.name === 'ios')
        .preference.find(({$}) => $.name === 'deployment-target');

      return Number(iosDeploymentTargetXMLTag.$.value);
    }
    case 'macos': {
      const {
        widget: {platform: platformList},
      } = await parseFile('config.xml');

      const iosDeploymentTargetXMLTag = platformList
        .find(({$}) => $.name === 'osx')
        .preference.find(({$}) => $.name === 'deployment-target');

      return Number(iosDeploymentTargetXMLTag.$.value);
    }
    case 'windows': {
      return 7;
    }
    case 'linux': {
      return 16;
    }
  }
}
