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
import path from 'path';
import CopyPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';
import {baseConfig, browserConfig, require, __dirname, TS_LOADER, GENERATE_CSS_RTL_LOADER} from './webpack_base.mjs';
import {merge} from 'webpack-merge';

import {getRootDir} from '../build/get_root_dir.mjs';

const BABEL_LOADER = {
  loader: 'babel-loader',
  options: {
    presets: ['@babel/preset-env'],
  },
};

export default merge(baseConfig, browserConfig, {
  devServer: {
    open: '/index_cordova.html',
    static: path.resolve(getRootDir(), 'platforms', 'browser', 'www'),
  },
  entry: [path.resolve(__dirname, 'app', 'cordova_main.ts')],
  target: ['web', 'es5'],
  module: {
    rules: [
      {
        test: /\.m?ts$/,
        exclude: /node_modules/,
        use: [BABEL_LOADER, TS_LOADER, GENERATE_CSS_RTL_LOADER],
      },
      {
        test: /\.m?ts$/,
        include: /node_modules/,
        use: [BABEL_LOADER, TS_LOADER],
      },
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: [BABEL_LOADER, GENERATE_CSS_RTL_LOADER],
      },
      {
        test: /\.m?js$/,
        include: /node_modules/,
        use: [BABEL_LOADER],
      },
    ],
  },
  plugins: [
    new CopyPlugin(
      [{from: require.resolve('@webcomponents/webcomponentsjs/custom-elements-es5-adapter.js'), to: 'webcomponentsjs'}],
      {context: __dirname}
    ),
    new webpack.DefinePlugin({
      // Statically link the Roboto font, rather than link to fonts.googleapis.com
      'window.polymerSkipLoadingFontRoboto': JSON.stringify(true),
    }),
    new HtmlWebpackPlugin({
      filename: 'index_cordova.html',
      template: path.resolve(__dirname, 'index_cordova.html'),
    }),
  ],
});
