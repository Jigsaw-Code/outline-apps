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

import {getVersion} from "./get_version.mjs";
import {getBuildNumber} from "./get_build_number.mjs";
import url from "url";
import minimist from "minimist";

/*
  Inputs:
  => platform: the platform to generate the environment.json for
  => buildMode: the buildMode of binary to build, i.e. debug or release

  Outputs:
  => the environment.json contents
*/
export async function environmentJson(platform, buildMode) {
  if (!platform) {
    throw new Error("environmentJson requires a platform argument");
  }

  if (!(buildMode === "debug" || buildMode === "release")) {
    throw new Error("environmentJson requires a buildMode argument of either 'debug' or 'release'");
  }

  if (buildMode === "release" && !process.env.SENTRY_DSN) {
    throw new Error("Release builds require SENTRY_DSN, but it is not defined.");
  }

  return {
    SENTRY_DSN: process.env.SENTRY_DSN,
    APP_VERSION: `${await getVersion(platform)}${buildMode === "debug" ? "-debug" : ""}`,
    APP_BUILD_NUMBER: await getBuildNumber(platform)
  };
}

async function main() {
  const { _, buildMode } = minimist(process.argv);

  const platform = _[2];

  console.log(JSON.stringify(await environmentJson(platform, buildMode)));
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  (async function() {
    return main();
  })();
}

