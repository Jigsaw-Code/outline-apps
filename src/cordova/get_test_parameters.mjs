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
import os from 'os';

const VALID_PLATFORMS = ['linux', 'windows', 'ios', 'macos', 'android', 'browser'];

const DEFAULT_IOS_DEVICE_MODEL = 'iPhone 14';
const DEFAULT_MACOS_ARCH = 'x86_64';

/*
  Inputs:
  => platform: the list of action arguments passed in

  Outputs:
  => an object containing the specificed platform and buildMode.
*/
export function getTestParameters(buildParameters) {
  let {
    _: [platform],
    verbose,
    osVersion,
    deviceModel,
    cpuArchitecture,
  } = minimist(buildParameters);

  if (platform && !VALID_PLATFORMS.includes(platform)) {
    throw new TypeError(
      `Platform "${platform}" is not a valid target for Outline Client. Must be one of ${VALID_PLATFORMS.join(', ')}`
    );
  }

  // set defaults
  platform ??= 'browser';

  // Device model can only be specified for iOS
  if (platform === 'ios') {
    deviceModel ??= DEFAULT_IOS_DEVICE_MODEL;
  }

  // CPU architecture can only be specified for macOS
  if (!cpuArchitecture && platform == 'macos') {
    cpuArchitecture = DEFAULT_MACOS_ARCH;
  }

  return {platform, verbose, osVersion, deviceModel, cpuArchitecture};
}
