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
import fs from "fs";
import path from "path";
import {spawn} from "child_process";
import url from "url";

import {rootDir} from "./root_dir.mjs";

const spawnStream = (command, parameters) =>
  new Promise((resolve, reject) => {
    const childProcess = spawn(command, parameters, {shell: true});

    childProcess.stdout.on("data", data => console.info(data.toString()));
    childProcess.stderr.on("data", error => console.error(chalk.red(error.toString())));

    childProcess.on("close", code => {
      if (code === 0) {
        resolve(childProcess);
      } else {
        reject(childProcess);
      }
    });
  });

const resolveActionPath = async actionPath => {
  if (!actionPath) return "";

  const roots = [process.env.ROOT_DIR, path.join(process.env.ROOT_DIR, "src")];
  const extensions = ["sh", "mjs"];

  for (const root of roots) {
    for (const extension of extensions) {
      const pathCandidate = `${path.resolve(root, actionPath)}.action.${extension}`;

      if (fs.existsSync(pathCandidate)) {
        return pathCandidate;
      }
    }
  }
};

export async function runAction(actionPath, ...parameters) {
  const resolvedPath = await resolveActionPath(actionPath);
  if (!resolvedPath) {
    console.info("Please provide an action to run.");
    console.info(actionPath, resolvedPath);
    // return runAction("list");
  }

  const startTime = performance.now();
  console.group(chalk.yellow.bold(`▶ action(${actionPath}):`));

  try {
    if (resolvedPath.endsWith("mjs")) {
      const action = await import(resolvedPath);

      await action.main(...parameters);
    } else {
      await spawnStream("bash", [resolvedPath, ...parameters]);
    }
  } catch (error) {
    console.groupEnd();
    console.error(chalk.red.bold(`▶ action(${actionPath}):`), chalk.red(`❌ Failed.`));

    process.exit(1);
  }

  console.groupEnd();
  console.info(
    chalk.green.bold(`▶ action(${actionPath}):`),
    chalk.green(`🎉 Success!`, chalk.italic.gray(`(${Math.floor(performance.now() - startTime)}ms)`))
  );
}

async function main() {
  process.env.ROOT_DIR = rootDir();
  process.env.BUILD_DIR = path.join(process.env.ROOT_DIR, "build");

  console.log(process.env.ROOT_DIR, process.env.BUILD_DIR);

  return runAction(...process.argv.slice(2));
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  await main();
}
