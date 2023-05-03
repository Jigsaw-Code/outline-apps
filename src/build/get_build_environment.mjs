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

/*
  Inputs:
  => buildMode: the buildMode of binary to build, i.e. debug or release
  => candidateId: the candidateId of the release build
  => sentryDsn: the sentryDsn of the release build

  Outputs:
  => the build environment object
*/
export async function getBuildEnvironment(buildMode, candidateId, sentryDsn) {
  if (buildMode === 'release') {
    if (!candidateId) {
      throw new TypeError('Release builds require candidateId, but it is not defined.');
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

  const APP_BUILD_NUMBER = Date.now() / 1000 / 60 / 60;

  return {
    SENTRY_DSN: sentryDsn,
    APP_VERSION: `${candidateId.replace(/-rc\.\d+/, '')} (${APP_BUILD_NUMBER})`,
    APP_BUILD_NUMBER,
  };
}
