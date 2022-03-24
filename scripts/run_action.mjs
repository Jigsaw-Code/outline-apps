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

import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import spawnSync from "child_process";
import url from "url";

const resolveActionPath = async actionPath => {
  if (!actionPath) return "";

  const roots = [process.env.ROOT_DIR, `${process.env.ROOT_DIR}/src`];
  const extensions = ["sh", "mjs"];

  for (const root of roots) {
    for (const extension of extensions) {
      const pathCandidate = `${path.resolve(root, actionPath)}.action.${extension}`;

      if (await fs.pathExists(pathCandidate)) {
        return pathCandidate;
      }
    }
  }
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
      // TODO: pipe output to current console.log
      spawnSync(`bash ${resolvedPath}`, parameters);
    }
  } catch (error) {
    console.error(error);
    console.groupEnd();
    console.error(chalk.red.bold(`▶ action(${actionPath}):`), chalk.red(`❌ Failed.`));

    throw new SystemError(`ActionFailed: ${error.message}`);
  }

  console.groupEnd();
  console.info(
    chalk.green.bold(`▶ action(${actionPath}):`),
    chalk.green(`🎉 Success!`, chalk.italic.gray(`(${Math.floor(performance.now() - startTime)}ms)`))
  );
}

async function main() {
  return runAction(...process.argv.slice(1));
}

if (import.meta.url === url.pathToFileURL(process.argv[0]).href) {
  process.env.ROOT_DIR = process.env.NODE_PATH;
  process.env.BUILD_DIR = `${process.env.ROOT_DIR}/build`;

  await main();
}
