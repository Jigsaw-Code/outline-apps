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
import minimist from 'minimist';

const VALID_PLATFORMS = ['linux', 'windows', 'ios', 'macos', 'android', 'browser'];
const VALID_BUILD_MODES = ['debug', 'release'];

/*
  Inputs:
  => platform: the list of action arguments passed in

  Outputs:
  => an object containing the specificed platform and buildMode.
*/
export function getBuildParameters(buildParameters) {
  let {
    _: [platform],
    buildMode,
  } = minimist(buildParameters);

  if (platform && !VALID_PLATFORMS.includes(platform)) {
    throw new TypeError(
      `Platform "${platform}" is not a valid target for Outline Client. Must be one of ${VALID_PLATFORMS.join(', ')}`
    );
  }

  if (buildMode && !VALID_BUILD_MODES.includes(buildMode)) {
    throw new TypeError(
      `Build mode "${buildMode}" is not a valid build mode for Outline Client. Must be one of ${VALID_BUILD_MODES.join(
        ', '
      )}`
    );
  }

  // set defaults
  platform ??= 'browser';
  buildMode ??= 'debug';

  return {platform, buildMode, cordovaPlatform: platform === 'macos' ? 'osx' : platform};
}

async function main() {
  console.log(getBuildParameters(process.argv.slice(2)));
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main();
}
