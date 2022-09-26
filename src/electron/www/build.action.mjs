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

import fs from 'fs/promises';
import url from 'url';
import path from 'path';

import {runWebpack} from '../../build/run_webpack.mjs';
import {getBuildParameters} from '../../build/get_build_parameters.mjs';
import {getBuildEnvironment} from '../../build/get_build_environment.mjs';
import {getProjectRootDir} from '../../build/get_project_root_dir.mjs';
import {getWebpackBuildMode} from '../../build/get_webpack_build_mode.mjs';

import webpackConfig from './webpack_config.mjs';

/**
 * @description Builds the web UI for use across both electron and cordova.
 *
 * @param {string[]} parameters
 */
export async function main(...parameters) {
  const {platform, buildMode, sentryDsn} = getBuildParameters(parameters);

  // write build environment
  await fs.mkdir(path.resolve(getProjectRootDir(), 'www'), {recursive: true});
  await fs.writeFile(
    path.resolve(getProjectRootDir(), 'www', 'environment.json'),
    JSON.stringify(await getBuildEnvironment(platform, buildMode, sentryDsn))
  );

  await runWebpack({
    ...webpackConfig,
    mode: getWebpackBuildMode(buildMode),
  });
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
