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

import url from "url";

const FILE_PREFIX = "file://";

// WARNING: if you move this file, you MUST update this file path
const PATH_FROM_ROOT_TO_THIS_FILE = "/scripts/root_dir.mjs";

export function rootDir() {
  return import.meta.url.replace(FILE_PREFIX, "").replace(PATH_FROM_ROOT_TO_THIS_FILE, "");
}

async function main() {
  console.log(rootDir());
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main();
}
