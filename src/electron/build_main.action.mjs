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

import {getBuildEnvironment} from '../build/get_build_environment.mjs';
import {getElectronBuildParameters} from './get_electron_build_parameters.mjs';
import {getVersion} from '../build/get_version.mjs';
import {getWebpackBuildMode} from '../build/get_webpack_build_mode.mjs';
import {runAction} from '../build/run_action.mjs';
import {runWebpack} from '../build/run_webpack.mjs';
import electronMainWebpackConfigs from './webpack_electron_main.mjs';
import fs from 'fs/promises';
import path from 'path';
import url from 'url';
import {getRootDir} from '../build/get_root_dir.mjs';

const ELECTRON_BUILD_DIR = 'build';

export async function main(...parameters) {
  const {platform, buildMode, sentryDsn} = getElectronBuildParameters(parameters);
  const {APP_VERSION} = await getBuildEnvironment(platform, buildMode, sentryDsn);

  await runAction('www/build', platform, `--buildMode=${buildMode}`);

  // TODO(daniellacosse): separate building the preload script out into its own separate step
  await runWebpack(
    electronMainWebpackConfigs({sentryDsn, APP_VERSION}).map(config => ({
      ...config,
      mode: getWebpackBuildMode(buildMode),
    }))
  );

  if (platform === 'windows') {
    let windowsEnvironment = `!define RELEASE "${await getVersion(platform)}"`;

    if (sentryDsn) {
      const {username: apiKey, pathname: projectID} = new URL(sentryDsn);

      windowsEnvironment += `\n!define SENTRY_URL "https://sentry.io/api${projectID}/store/?sentry_version=7&sentry_key=${apiKey}"`;
    } else {
      windowsEnvironment += `\n!define SENTRY_URL "<debug>"`;
    }

    await fs.writeFile(path.resolve(getRootDir(), ELECTRON_BUILD_DIR, 'env.nsh'), windowsEnvironment);
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
