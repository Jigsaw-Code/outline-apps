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

import {Linter, Configuration} from "tslint";
import fs from "fs/promises";
import nodegit from "nodegit";
import path from "path";

import {getRootDir} from "../scripts/get_root_dir.mjs";

const REPOSITORY_PATH = path.resolve(getRootDir(), ".git");
const TSLINT_OPTIONS = {
  fix: false,
};

const linter = new Linter(TSLINT_OPTIONS);
const configuration = Configuration.findConfiguration("./src/tsconfig.json");

export async function main() {
  // TODO: filter unwanted folders
  const changedFiles = await (await nodegit.Repository.open(REPOSITORY_PATH)).getStatus();

  const lintingJobs = changedFiles.map(async file => {
    const filePath = path.resolve(getRootDir(), file.path());

    if (filePath.endsWith(".ts")) {
      const fileContents = await fs.readFile(filePath);

      linter.lint(filePath, fileContents, configuration);

      // TODO: ??
    }
  });

  await Promise.all(lintingJobs);

  console.log(linter.getResult());
}
