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
const MS_PER_HOUR = 1000 * 60 * 60;

/*
  Inputs:
  => cliParameters: the list of action arguments passed in

  Outputs:
  => the build environment object
*/
export function getWebEnvironment(sentryDsn, buildMode, versionName) {
  if (buildMode === 'release') {
    if (versionName === '0.0.0') {
      throw new TypeError('Release builds require a valid versionName, but it is set to 0.0.0.');
    }

    if (!sentryDsn) {
      throw new TypeError('Release builds require SENTRY_DSN, but it is not defined.');
    }

    /*
      the SENTRY_DSN follows a stardard URL format:
      https://docs.sentry.io/product/sentry-basics/dsn-explainer/#the-parts-of-the-dsn
    */
    try {
      new URL(sentryDsn);
    } catch (e) {
      throw new TypeError(`The sentryDsn ${sentryDsn} is not a valid URL!`);
    }
  }

  return {
    SENTRY_DSN: sentryDsn,
    APP_VERSION: buildMode === 'release' ? versionName : `${versionName}-${buildMode}`,
    APP_BUILD_NUMBER: Math.floor(Date.now() / MS_PER_HOUR),
  };
}
