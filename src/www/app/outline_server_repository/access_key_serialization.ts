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

import {makeConfig, SHADOWSOCKS_URI, SIP002_URI} from 'ShadowsocksConfig';

import * as errors from '../../model/errors';

import {ShadowsocksConfig} from '../config';

// DON'T use these methods outside of this folder!

// Parses an access key string into a ShadowsocksConfig object.
export function accessKeyToShadowsocksConfig(accessKey: string): ShadowsocksConfig {
  try {
    const config = SHADOWSOCKS_URI.parse(accessKey);
    return {
      host: config.host.data,
      port: config.port.data,
      method: config.method.data,
      password: config.password.data,
      name: config.tag.data,
    };
  } catch (error) {
    throw new errors.ServerUrlInvalid(error.message || 'failed to parse access key');
  }
}

// Enccodes a Shadowsocks proxy configuration into an access key string.
export function shadowsocksConfigToAccessKey(config: ShadowsocksConfig): string {
  return SIP002_URI.stringify(
    makeConfig({
      host: config.host,
      port: config.port,
      method: config.method,
      password: config.password,
      tag: config.name,
    })
  );
}
