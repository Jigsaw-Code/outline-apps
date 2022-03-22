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

import {path, chalk, argv} from "zx/globals";
import url from "url";

const resolveActionPath = async actionPath => {
  let result = "";

  if (!actionPath) return result;

  const currentDirectory = process.cwd();
  const rootsQueue = [currentDirectory, `${currentDirectory}/src`];

  while (rootsQueue.length && !result) {
    const root = rootsQueue.shift();
    const pathCandidate = path.resolve(root, actionPath);
    const extensionsQueue = ["sh", "mjs"];

    while (extensionsQueue.length && !result) {
      const extension = extensionsQueue.shift();

      if (await fs.pathExists(`${pathCandidate}.action.${extension}`)) {
        result = `${pathCandidate}.action.${extension}`;
      }
    }
  }

  return result;
};

export async function runAction(actionPath, ...parameters) {
  const resolvedPath = await resolveActionPath(actionPath);
  if (!resolvedPath) {
    console.info("Please provide an action to run.");
    return runAction("list");
  }

  const startTime = performance.now();
  console.group(chalk.yellow.bold(`▶ action(${actionPath}):`));

  try {
    if (resolvedPath.endsWith("mjs")) {
      const {main} = await import(resolvedPath);

      await main(...parameters);
    } else {
      await $`bash ${resolvedPath} ${parameters}`;
    }
  } catch (error) {
    console.error(error);
    console.groupEnd();
    console.error(chalk.red.bold(`▶ action(${actionPath}):`), chalk.red(`❌ Failed.`));

    throw new Error("ActionFailed");
  }

  console.groupEnd();
  console.info(
    chalk.green.bold(`▶ action(${actionPath}):`),
    chalk.green(`🎉 Success!`, chalk.italic.gray(`(${Math.floor(performance.now() - startTime)}ms)`))
  );
}

async function main() {
  return runAction(...argv._.slice(1));
}

if (import.meta.url === url.pathToFileURL(argv._[0]).href) {
  await main();
}
