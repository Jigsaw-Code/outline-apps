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

import os from "os";
import {existsSync} from "fs";
import {execSync} from "child_process";
import path from "path";

import cordovaLib from "cordova-lib";
const {cordova} = cordovaLib;

import {getBuildParameters} from "../../scripts/get_build_parameters.mjs";

const CORDOVA_PLATFORMS = ["ios", "osx", "android"];
const WORKING_CORDOVA_OSX_COMMIT = "07e62a53aa6a8a828fd988bc9e884c38c3495a67";

export const dependencies = ["resources", "src/cordova", "cordova-plugin-outline"];
export const requirements = ["www/build"];

/**
 * @description TODO
 */
export async function main(...parameters) {
  const {platform} = getBuildParameters(parameters);
  const isApple = platform === "ios" || platform === "osx";

  if (!CORDOVA_PLATFORMS.includes(platform)) {
    throw new TypeError(
      `The platform "${platform}" is not a valid Cordova platform. It must be one of: ${CORDOVA_PLATFORMS.join(", ")}.`
    );
  }

  if (isApple && os.platform() !== "darwin") {
    throw new SystemError("Building an Apple binary requires xcodebuild and can only be done on MacOS");
  }

  if (!existsSync(path.resolve(process.env.ROOT_DIR, `platforms/${platform}`))) {
    await cordova.platform(
      "add",
      [platform === "osx" ? `github:apache/cordova-osx#${WORKING_CORDOVA_OSX_COMMIT}` : platform],
      {save: false}
    );
  }

  await cordova.prepare({platforms: [platform], save: false});

  if (isApple) {
    // since apple can only be build on darwin systems, we don't have to worry about windows support here
    execSync(`rsync -avc src/cordova/apple/xcode/${platform}/ platforms/${platform}/`, {stdio: "inherit"});
  }
}
