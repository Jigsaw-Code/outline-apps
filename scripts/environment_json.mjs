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

/*
  Inputs:
  => platform: the platform to generate the environment.json for
  => release: whether or not this is a releasable binary

  Outputs:
  => the environment.json contents
*/
export async function environmentJson(platform, release) {
  if (release && !process.env.SENTRY_DSN) {
    throw new Error("Release builds require SENTRY_DSN, but it is not defined.");
  }

  return {
    SENTRY_DSN: process.env.SENTRY_DSN,
    APP_VERSION: platform ? await getVersion(platform) : "0.0.0-dev",
    APP_BUILD_NUMBER: await getBuildNumber(platform)
  };
}

async function main() {
  const [platform, release] = process.argv.slice(2);

  console.log(JSON.stringify(await environmentJson(platform, release)));
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main();
}

