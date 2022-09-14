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

import {getBuildParameters} from '../build/get_build_parameters.mjs';

const ELECTRON_PLATFORMS = ['linux', 'windows'];

/*
  Inputs:
  => platform: the list of action arguments passed in

  Outputs:
  => an object containing the required electron parameters.
*/
export function getElectronBuildParameters(parameters) {
  const {platform, buildMode, stagingPercentage, sentryDsn} = getBuildParameters(parameters);

  if (!ELECTRON_PLATFORMS.includes(platform)) {
    throw new TypeError(
      `The platform "${platform}" is not a valid Electron platform. It must be one of: ${ELECTRON_PLATFORMS.join(
        ', '
      )}.`
    );
  }

  return {platform, buildMode, stagingPercentage, sentryDsn};
}
