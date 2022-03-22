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

const resolveActionPath = async actionPath => {
  let result = "";

  if (!actionPath) return result;

  const currentDirectory = (await $`pwd`).toString().trim();
  const roots = [currentDirectory, `${currentDirectory}/src`];

  while (roots.length && !result) {
    const root = roots.shift();
    const pathCandidate = path.resolve(root, actionPath);
    const extensions = ["sh", "mjs"];

    while (extensions.length && !result) {
      const extension = extensions.shift();

      if (await fs.pathExists(`${pathCandidate}.action.${extension}`)) {
        result = `${pathCandidate}.action.${extension}`;
      }
    }
  }

  return result;
};

/**
 *
 * @param {*} actionPath
 * @returns
 */
export async function runAction(actionPath) {
  const resolvedPath = await resolveActionPath(actionPath);
  if (!resolvedPath) {
    console.info("Please provide an action to run.");
    return runAction("list");
  }

  const startTime = performance.now();
  console.group(chalk.yellow.bold(`▶ action(${actionPath}):`));

  try {
    if (resolvedPath.endsWith("mjs")) {
      const module = await import(resolvedPath);

      await module.main();
    } else {
      await $`bash ${resolvedPath} ${argv._.slice(2)}`;
    }
  } catch (error) {
    console.error(error);
    console.groupEnd();
    console.error(chalk.red.bold(`▶ action(${actionPath}):`), chalk.red(`❌ Failed.`));

    return $`exit 1`;
  }

  console.groupEnd();
  console.info(
    chalk.green.bold(`▶ action(${actionPath}):`),
    chalk.green(`🎉 Success!`, chalk.italic.gray(`(${Math.floor(performance.now() - startTime)}ms)`))
  );
}

async function main() {
  const {
    _: [thisPath, actionPath],
  } = argv;

  return runAction(actionPath);
}

if (import.meta.url === url.pathToFileURL(argv._[0]).href) {
  await main();
}
