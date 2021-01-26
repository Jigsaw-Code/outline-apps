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

const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const WebpackShellPluginNext = require('webpack-shell-plugin-next');

const OUTPUT_BASE = path.resolve(__dirname, '../../www');

exports.makeConfig = (options) => {
  return {
    entry: [
      require.resolve('@webcomponents/webcomponentsjs/webcomponents-bundle.js'),
      path.resolve(__dirname, './style.css'),
      // path.resolve(__dirname, './ui_components/licesnses/licenses.txt'),
      options.main,
    ],
    mode: 'production',
    target: options.target,
    output: {
      path: OUTPUT_BASE,
      filename: 'main.js',
      environment: {
        // We must tell Webpack what kind of ES-features (ES5 only) may be
        // used in the generated runtime-code.
        arrowFunction: false,
        const : false,
        destructuring: false,
        forOf: false,
      }
    },
    module: {
      rules: [
        {
          test: /\.css?$/,
          use: [
            'style-loader',
            'css-loader',
          ],
        },
        ...options.extraModuleRules,
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      fallback: {'url': require.resolve('url/')},
    },
    plugins: [
      // This is a workaround to address a Cordova build issue. The command
      // `cordova platform add` modifies the `node_modules` directory, removing
      // packages that are needed to build the app. We reinstall any missing
      // packages so that they are present during the build.
      new WebpackShellPluginNext({
        onBuildStart: {scripts: ['yarn install --check-files'], blocking: true},
      }),
      new CopyPlugin(
          [
            {from: 'assets', to: 'assets'},
            {from: 'messages', to: 'messages'},
            {from: 'ui_components/licenses/licenses.txt', to: 'ui_components/licenses'},
          ],
          {context: __dirname}),
      ...options.extraPlugins,
    ],
  };
};
