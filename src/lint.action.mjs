// Copyright 2022 The Outline Authors

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//      http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Linter, Configuration } from "tslint";
import fs from "fs/promises";

import { getChangedFilepaths } from "../scripts/get_changed_filepaths.mjs";

const TSLINT_OPTIONS = {
  fix: false,
};

export async function main() {
  const linter = new Linter(TSLINT_OPTIONS);
  const configuration = Configuration.findConfiguration("./src/tsconfig.json");

  const changedFilepaths = await getChangedFilepaths({
    extensions: [".ts"],
    excludePaths: [".github", "docs", "resources", "third_party", "tools"],
  });

  const lintingJobs = changedFilepaths.map(async (filePath) => {
    const fileContents = await fs.readFile(filePath);

    linter.lint(filePath, fileContents, configuration);
  });

  await Promise.all(lintingJobs);

  // TODO: do something if there are errors here, I guess
  console.log(linter.getResult());
}
