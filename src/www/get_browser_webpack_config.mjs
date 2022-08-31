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

import electronConfig from './webpack_electron.mjs';
import cordovaConfig from './webpack_cordova.mjs';
import {getWebpackBuildMode} from '../build/get_webpack_build_mode.mjs';

/*
  Inputs:
  => the platform and buildMode

  Outputs:
  => the webpack config for the given platform and buildMode
*/
export const getBrowserWebpackConfig = (platform, buildMode) => {
  let webpackConfig;

  switch (platform) {
    case 'linux':
    case 'windows':
      webpackConfig = electronConfig;
      break;
    case 'android':
    case 'browser':
    case 'ios':
    case 'macos':
    default:
      webpackConfig = cordovaConfig;
      break;
  }

  webpackConfig.mode = getWebpackBuildMode(buildMode);

  return webpackConfig;
};
