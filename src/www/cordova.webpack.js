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
const BABEL_LOADER = {
  loader: 'babel-loader',
  options: {
    presets: [
      '@babel/preset-env',
    ],
  },
};

module.exports = {
  entry: [
    require.resolve('@webcomponents/webcomponentsjs/custom-elements-es5-adapter.js'),
    require.resolve('@babel/polyfill/dist/polyfill.min.js'),
    require.resolve('web-animations-js/web-animations-next-lite.min.js'),
    require.resolve('@webcomponents/webcomponentsjs/webcomponents-loader.js'),
    path.resolve(__dirname, './style.css'),
    path.resolve(__dirname, './app/cordova_main.ts'),
  ],
  mode: 'production',
  target: 'web',
  output: {path: OUTPUT_BASE, filename: 'main.js'},
  module: {
    rules: [
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
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          BABEL_LOADER,
          GENERATE_CSS_RTL_LOADER,
        ]
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
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {'url': require.resolve('url/')},
  },
  plugins: [
    new webpack.DefinePlugin({
      // Statically link the Roboto font, rather than link to fonts.googleapis.com
      'window.polymerSkipLoadingFontRoboto': JSON.stringify(true),
    }),
    new CopyPlugin(
        [
          {from: 'assets', to: 'assets'},
          {from: 'messages', to: 'messages'},
        ],
        {context: __dirname}),
    new HtmlWebpackPlugin({
      filename: 'cordova_index.html',
      template: path.resolve(__dirname, './cordova_index.html'),
    }),
  ],
};
