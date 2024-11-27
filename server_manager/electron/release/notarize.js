/* eslint-disable @typescript-eslint/no-var-requires */
// Copyright 2020 The Outline Authors
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

const {notarize} = require('electron-notarize');

// Notarizes the macOS app through an Apple Developer Account when building for release.
// Must set environment variables: `APPLE_ID`, the account's Apple ID;
// and `APPLE_PASSWORD`, the password to the account.
exports.default = async function (context) {
  const {electronPlatformName, appOutDir} = context;
  if (electronPlatformName !== 'darwin' || !process.env.CSC_LINK) {
    // Skip notarization if not releasing macOS or if the app is unsigned (i.e. packaging).
    // `CSC_LINK` is the path to a signing certificate; setting it makes Electron sign the app.
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  console.log(`Notarizing ${appName}. This may take a few minutes.`);
  await notarize({
    tool: 'notarytool',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,

    // You'll have to generate a one-time password as the
    // notary tool does not support 2FA:
    // https://support.apple.com/en-us/HT204397
    appleIdPassword: process.env.APPLE_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
