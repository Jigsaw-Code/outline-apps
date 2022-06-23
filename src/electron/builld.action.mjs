// import

import {webpackPromise} from '../build/webpack_promise.mjs';
import {getWebpackBuildMode} from '../build/get_webpack_build_mode.mjs';
import {getBuildParameters} from '../build/get_build_parameters.mjs';
import {runAction} from '../build/run_action.mjs';

import electronMainWebpackConfig from './webpack_electron_main.mjs';
import fs from 'fs/promises';
import {getVersion} from '../build/get_version.mjs';

import electronConfig from './electron-builder.json';
import electron from 'electron-builder';

export async function main(...parameters) {
  const {platform, buildMode, stagingPercentage, networkStack} = getBuildParameters(parameters);
  const version = await getVersion(platform);

  // WIP: is SENTRY_DSN required on windows?
  let sentryAPI;
  if (process.env.SENTRY_DSN) {
    const {username: apiKey, pathname: projectID} = new URL(process.env.SENTRY_DSN);

    sentryAPI = `https://sentry.io/api/${projectID}/store/?sentry_version=7&sentry_key=${apiKey}"`;
  }

  runAction('www/build', platform, `--buildMode=${buildMode}`);

  await webpackPromise({
    ...electronMainWebpackConfig({networkStack}),
    mode: getWebpackBuildMode(buildMode),
  });

  // WIP: electron icon maker??
  // electron-icon-maker --input=resources/electron/icon.png --output=build

  if (platform === 'windows') {
    await fs.writeFile(
      'build/env.nsh',
      `!define RELEASE "${version}"
!define SENTRY_URL "${sentryAPI}"`
    );
  }

  await electron.build({
    publish: 'never',
    config: {
      ...electronConfig,
      linux: platform === 'linux',
      win: platform === 'windows',
      generateUpdatesFilesForAllChannels: buildMode === 'release',
      extraMetadata: {
        ...electronConfig.extraMetadata,
        version,
      },
    },
  });

  if (stagingPercentage === 100) {
    return;
  }

  const platformSuffix = platform === 'linux' ? '-linux' : '';

  await fs.appendFile(`build/dist/beta${platformSuffix}.yml`, `stagingPercentage: ${stagingPercentage}`);
  await fs.appendFile(`build/dist/latest${platformSuffix}.yml`, `stagingPercentage: ${stagingPercentage}`);
}
