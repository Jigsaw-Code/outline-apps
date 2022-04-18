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

import {cordova} from "cordova-lib";

import {runAction} from "../scripts/run_action.mjs";

const CORDOVA_PLATFORMS = ["ios", "osx", "android"];

export async function main(...parameters) {
  const {platform, buildMode} = getBuildParameters(parameters);

  if (!CORDOVA_PLATFORMS.includes(platform)) {
    throw new TypeError(
      `The platform "${platform}" is not a valid Cordova build target. It must be one of: ${CORDOVA_PLATFORMS.join(
        ", "
      )}.`
    );
  }

  if (platform === "android" && !(process.env.ANDROID_KEY_STORE_PASSWORD && process.env.ANDROID_KEY_STORE_CONTENTS)) {
    throw new ReferenceError(
      "Both 'ANDROID_KEY_STORE_PASSWORD' and 'ANDROID_KEY_STORE_CONTENTS' must be defined in the environment to build an Android Release!"
    );
  }

  await runAction("www/build", platform, `--buildMode=${buildMode}`);
  await runAction("cordova/setup", platform, `--buildMode=${buildMode}`);

  await cordova.compile({
    platforms: [platform],
    options: {
      device: platform === "ios",
      release: buildMode === "release",
      gradleArg: platform === "android" && "-PcdvBuildMultipleApks=true",
      // something:
      //   '--keystore=keystore.p12 --alias=privatekey "--storePassword=$ANDROID_KEY_STORE_PASSWORD" "--password=$ANDROID_KEY_STORE_PASSWORD"',
    },
  });
}
