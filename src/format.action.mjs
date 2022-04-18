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

import prettier from "prettier";
import fs from "fs/promises";

import { getChangedFilepaths } from "../scripts/get_changed_filepaths.mjs";

const PRETTIER_OPTIONS = {
  singleQuote: true,
  bracketSpacing: false,
  printWidth: 100,
};

export async function main() {
  const changedFilepaths = await getChangedFilepaths({
    extensions: [".html", ".md", ".json", ".js", ".cjs", ".mjs", ".ts"],
    excludePaths: [".github", "docs", "resources", "third_party", "tools"],
  });

  const formattingJobs = changedFilepaths.map(async (filePath) => {
    const fileContents = await fs.readFile(filePath);
    const formattedContents = prettier.format(fileContents, PRETTIER_OPTIONS);

    await fs.writeFile(filePath, formattedContents);
  });

  await Promise.all(formattingJobs);
}
