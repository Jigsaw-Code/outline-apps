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
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const {makeConfig} = require('./base.webpack.js');

const GENERATE_CSS_RTL_LOADER = path.resolve(__dirname, '../../scripts/rtl_css_webpack.js');
const BABEL_LOADER = {
  loader: 'babel-loader',
  options: {
    presets: [[
      '@babel/preset-env', {
        'targets': 'defaults',
      }
    ]]
  },
};

module.exports = makeConfig({
  main: path.resolve(__dirname, './app/cordova_main.ts'),
  target: 'web',
  extraModuleRules: [
    {
      test: /\.ts(x)?$/,
      exclude: /node_modules/,
      use: [
        BABEL_LOADER,
        'ts-loader',
        GENERATE_CSS_RTL_LOADER,
      ],
    },
    {
      test: /\.m?ts$/,
      include: /node_modules/,
      use: [
        BABEL_LOADER,
        'ts-loader',
      ],
    },
    {
      test: /\.js$/,
      exclude: /node_modules/,
      use: [BABEL_LOADER, GENERATE_CSS_RTL_LOADER],
    },
    {
      // Loads and transpiles dependencies (including .mjs ES modules)
      test: /\.m?js$/,
      include: /node_modules/,
      use: [BABEL_LOADER],
    },
  ],
  extraPlugins: [
    new webpack.DefinePlugin({
      // Statically link the Roboto font, rather than link to fonts.googleapis.com
      'window.polymerSkipLoadingFontRoboto': JSON.stringify(true),
    }),
    new HtmlWebpackPlugin({
      filename: 'cordova_index.html',
      template: path.resolve(__dirname, './cordova_index.html'),
    }),
  ]
});
