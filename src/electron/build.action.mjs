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
import {getVersion} from '../build/get_version.mjs';
import {runAction} from '../build/run_action.mjs';
import electron, {Platform} from 'electron-builder';
import fs from 'fs/promises';
import url from 'url';
import {getRootDir} from '../build/get_root_dir.mjs';
import path from 'path';

export async function main(...parameters) {
  const {platform, buildMode, stagingPercentage} = getBuildParameters(parameters);
  const version = await getVersion(platform);

  await runAction('www/build', platform, `--buildMode=${buildMode}`);
  await runAction('electron/build_main', ...parameters);
  await runAction('electron/build_icons', '--input=resources/electron/icon.png', '--output=build');

  const electronConfig = JSON.parse(
    await fs.readFile(path.resolve(getRootDir(), './src/electron/electron-builder.json'))
  );

  // build electron binary
  await electron.build({
    publish: 'never',
    targets: Platform[platform.toLocaleUpperCase()].createTarget(),
    config: {
      ...electronConfig,
      generateUpdatesFilesForAllChannels: buildMode === 'release',
      extraMetadata: {
        ...electronConfig.extraMetadata,
        version,
      },
    },
  });

  if (stagingPercentage !== 100) {
    const platformSuffix = platform === 'linux' ? '-linux' : '';

    await fs.appendFile(`build/dist/beta${platformSuffix}.yml`, `stagingPercentage: ${stagingPercentage}`);
    await fs.appendFile(`build/dist/latest${platformSuffix}.yml`, `stagingPercentage: ${stagingPercentage}`);
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main(...process.argv.slice(2));
}
