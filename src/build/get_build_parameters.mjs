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
    networkStack,
    stagingPercentage,
    sentryDsn,
  } = minimist(buildParameters);

  if ((stagingPercentage !== undefined && stagingPercentage < 0) || stagingPercentage > 100) {
    throw new RangeError('StagingPercentage must be a number between zero and one hundred!');
  }

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
  networkStack ??= 'libevbadvpn';
  stagingPercentage ??= 100;
  sentryDsn ??= process.env.SENTRY_DSN;

  return {platform, buildMode, stagingPercentage, networkStack, sentryDsn};
}
