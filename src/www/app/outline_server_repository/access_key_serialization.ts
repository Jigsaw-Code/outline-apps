// Copyright 2018 The Outline Authors
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

import {SHADOWSOCKS_URI} from 'ShadowsocksConfig';

import * as errors from '../../model/errors';

import {ShadowsocksSessionConfig} from '../tunnel';

// DON'T use these methods outside of this folder!

// Parses an access key string into a ShadowsocksConfig object.
export function accessKeyToShadowsocksSessionConfig(accessKey: string): ShadowsocksSessionConfig {
  try {
    const config = SHADOWSOCKS_URI.parse(accessKey);
    let plugin, pluginOptions;
    if (config.extra.plugin) {
      const pluginData = config.extra.plugin.split(';');
      plugin = pluginData[0];
      pluginOptions = pluginData.slice(1).join(';');
    }
    return {
      host: config.host.data,
      port: config.port.data,
      method: config.method.data,
      password: config.password.data,
      plugin,
      pluginOptions,
    };
  } catch (error) {
    throw new errors.ServerUrlInvalid(error.message || 'failed to parse access key');
  }
}
