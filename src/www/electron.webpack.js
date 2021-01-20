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
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

const OUTPUT_BASE = path.resolve(__dirname, '../../www');
const GENERATE_CSS_RTL_LOADER = path.resolve(__dirname, '../../scripts/rtl_css_webpack.js');

module.exports = {
  entry: [
    '@babel/polyfill',
    require.resolve('@webcomponents/webcomponentsjs/webcomponents-loader.js'),
    path.resolve(__dirname, './style.css'),
    path.resolve(__dirname, './app/electron_main.ts'),
  ],
  mode: 'production',
  target: 'electron-renderer',
  output: {path: OUTPUT_BASE, filename: 'main.js'},
  module: {
    rules: [
      {
        test: /\.ts(x)?$/,
        exclude: /node_modules/,
        use: [
          'ts-loader',
          GENERATE_CSS_RTL_LOADER,
        ],
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: GENERATE_CSS_RTL_LOADER,
      },
      {
        test: /\.css?$/,
        use: [
          'style-loader',
          'css-loader',
        ],
      }
    ]
  },
  resolve: {extensions: ['.tsx', '.ts', '.js']},
  plugins: [
    new webpack.DefinePlugin({
      // Hack to protect against @sentry/electron not having process.type defined.
      'process.type': JSON.stringify('renderer'),
      // Statically link the Roboto font, rather than link to fonts.googleapis.com
      'window.polymerSkipLoadingFontRoboto': JSON.stringify(true),
    }),
    // @sentry/electron depends on electron code, even though it's never activated
    // in the browser. Webpack still tries to build it, but fails with missing APIs.
    // The IgnorePlugin prevents the compilation of the electron dependency.
    new webpack.IgnorePlugin(/^electron$/),
    new CopyPlugin(
        [
          {from: 'assets', to: 'assets'},
          {from: 'messages', to: 'messages'},
        ],
        {context: __dirname}),
    new HtmlWebpackPlugin({
      filename: 'electron_index.html',
      template: path.resolve(__dirname, './electron_index.html'),
    }),
  ],
};
