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
const TerserPlugin = require('terser-webpack-plugin');
const WebpackShellPluginNext = require('webpack-shell-plugin-next');

const OUTPUT_BASE = path.resolve(__dirname, '../../www');

exports.makeConfig = (options) => {
  return {
    entry: [
      path.resolve(__dirname, './style.css'),
      options.main,
    ],
    mode: 'production',
    devtool: 'inline-source-map',
    target: options.target,
    output: {
      path: OUTPUT_BASE,
      filename: 'main.js',
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
    optimization: {
      minimizer: [new TerserPlugin({
        terserOptions: {
          keep_classnames: true,
          keep_fnames: true,
        }
      })],
    },
    plugins: [
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
