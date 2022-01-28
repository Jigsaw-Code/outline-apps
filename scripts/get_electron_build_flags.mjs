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
import minimist from "minimist";
import url from "url";
import { getVersion } from "./get_version.mjs";

export async function getElectronBuildFlags(platform, buildMode) {
  let buildFlags = [
    "--publish never",
    "--config src/electron/electron-builder.json",
    `--config.extraMetadata.version=${await getVersion(platform)}`
  ];

  if (platform === "linux") {
    buildFlags = ["--linux", ...buildFlags];
  } else if (platform === "win") {
    buildFlags = ["--win", ...buildFlags];
  }

  if (buildMode === "release") {
    // Publishing is disabled, updates are pulled from AWS. We use the generic provider instead of the S3
    // provider since the S3 provider uses "virtual-hosted style" URLs (my-bucket.s3.amazonaws.com)
    // which can be blocked by DNS or SNI without taking down other buckets.
    buildFlags = [
      ...buildFlags, 
      "--config.generateUpdatesFilesForAllChannels=true",
      "--config.publish.provider=generic",
      `--config.publish.url=https://s3.amazonaws.com/outline-releases/client/${platform}`
    ];
  }

  if (buildMode === "release" && platform === "win") {
    buildFlags.push("--config.win.certificateSubjectName='Jigsaw Operations LLC'");
  }

  return buildFlags;
}

async function main() {
  const { _, buildMode } = minimist(process.argv);
  
  const platform = _[2];

  console.log((await getElectronBuildFlags(platform, buildMode)).join(" "));
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  (async function() {
    return main();
  })();
}