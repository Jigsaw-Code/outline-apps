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
import TerserPlugin from 'terser-webpack-plugin';
import {fileURLToPath} from 'url';
import {createRequire} from 'module';

export const require = createRequire(import.meta.url);
export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

export const GENERATE_CSS_RTL_LOADER = path.resolve(__dirname, 'webpack_css_rtl_loader.cjs');

export const TS_LOADER = {
  loader: 'ts-loader',
  options: {
    configFile: path.resolve(__dirname, 'tsconfig.json'),
  },
};

export const baseConfig = {
  devtool: 'inline-source-map',
  resolve: {
    extensions: ['.ts', '.js', '.mts', '.mjs'],
    fallback: {url: require.resolve('url/')},
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          keep_classnames: true,
          keep_fnames: true,
        },
      }),
    ],
  },
  externals: {
    // See https://github.com/modernweb-dev/web/issues/1908.
    '/__web-dev-server__web-socket.js': 'commonjs __web-dev-server__web-socket.js',
  },
};

export const browserConfig = {
  entry: [path.resolve(__dirname, 'style.css')],
  output: {
    path: path.resolve(__dirname, '..', '..', 'www'),
    filename: 'main.js',
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /assets[/\\].*\.(png|woff2)$/,
        use: ['file-loader'],
      },
    ],
  },
  plugins: [
    new CopyPlugin(
      [
        {from: 'assets', to: 'assets'},
        {from: 'messages', to: 'messages'},
        {from: 'ui_components/licenses/licenses.txt', to: 'ui_components/licenses'},
      ],
      {context: __dirname}
    ),
  ],
};
