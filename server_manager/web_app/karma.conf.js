/* eslint-disable @typescript-eslint/no-var-requires */
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

const webpack = require('webpack');
const {makeConfig} = require('../base.webpack.js');
process.env.CHROMIUM_BIN = require('puppeteer').executablePath();

const baseConfig = makeConfig({
  defaultMode: 'development',
});

const test_patterns = [
  '**/*.spec.ts',
  // We need to test data_formatting in a browser context
  './data_formatting.spec.ts',
];

let preprocessors = {};
for (const pattern of test_patterns) {
  preprocessors[pattern] = ['webpack'];
}

module.exports = function (config) {
  config.set({
    frameworks: ['jasmine'],
    files: test_patterns,
    preprocessors,
    reporters: ['progress'],
    colors: true,
    logLevel: config.LOG_INFO,
    browsers: ['ChromiumHeadless'],
    singleRun: true,
    concurrency: Infinity,
    webpack: {
      module: baseConfig.module,
      resolve: baseConfig.resolve,
      plugins: [
        ...baseConfig.plugins,
        new webpack.ProvidePlugin({
          process: 'process/browser',
        }),
      ],
      mode: baseConfig.mode,
    },
  });
};
