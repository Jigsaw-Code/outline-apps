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

import {Config, makeConfig, SHADOWSOCKS_URI, SIP002_URI} from 'ShadowsocksConfig';
import {ServerUrlInvalid} from '../../model/errors';
import {ShadowsocksConfig} from '../config';

export class OutlineServerAccessKey implements ShadowsocksConfig {
  _rawConfig: Config;

  host?: string;
  port?: number;
  method?: string;
  password?: string;
  name?: string;

  isOutlineServer = false;

  static fromConfig({name, ...config}: ShadowsocksConfig) {
    return new OutlineServerAccessKey(
      SIP002_URI.stringify(
        makeConfig({
          ...config,
          tag: name,
        })
      )
    );
  }

  constructor(accessKey: string) {
    this.isOutlineServer = accessKey.includes('outline=1');

    try {
      this._rawConfig = SHADOWSOCKS_URI.parse(accessKey);
    } catch ({message}) {
      throw new ServerUrlInvalid(message ?? 'Failed to parse access key.');
    }

    this.host = this._rawConfig.host.data;
    this.port = this._rawConfig.port.data;
    this.method = this._rawConfig.method.data;
    this.password = this._rawConfig.password.data;
    this.name = this._rawConfig.tag.data;
  }

  isEqualTo(that: OutlineServerAccessKey) {
    return (
      this.host === that.host &&
      this.port === that.port &&
      this.password === that.password &&
      this.method === that.method
    );
  }

  toString() {
    return SIP002_URI.stringify(
      makeConfig({
        host: this.host,
        port: this.port,
        method: this.method,
        password: this.password,
        tag: this.name,
      })
    );
  }
}
