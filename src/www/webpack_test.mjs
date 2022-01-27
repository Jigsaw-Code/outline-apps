// Copyright 2020 The Outline Authors
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
import path from "path";
import {baseConfig, __dirname} from "./webpack_base.mjs";
import {merge} from "webpack-merge";
import glob from "glob";

console.log(glob.sync("./src/www/**/*.spec.ts"));

export default merge(baseConfig, {
  entry: glob.sync("./src/www/**/*.spec.ts"),
  target: "node",
  output: {
    path: path.resolve(__dirname, "../../build/test"),
    filename: "main.spec.js",
  },
  module: {
    rules: [
      {
        test: /\.m?ts$/,
        exclude: /node_modules/,
        use: ["ts-loader"]
      }
    ]
  }
});