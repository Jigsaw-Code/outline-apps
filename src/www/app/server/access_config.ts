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
import {ServerUrlInvalid, ServerIncompatible, ShadowsocksUnsupportedCipher} from '../../model/errors';
import {ShadowsocksConfig} from '../config';

export class OutlineServerAccessConfig implements ShadowsocksConfig {
  // We restrict to AEAD ciphers because unsafe ciphers are not supported in go-tun2socks.
  // https://shadowsocks.org/en/spec/AEAD-Ciphers.html
  private static readonly SUPPORTED_CIPHERS = new Set([
    'chacha20-ietf-poly1305',
    'aes-128-gcm',
    'aes-192-gcm',
    'aes-256-gcm',
  ]);

  host?: string;
  port?: number;
  method?: string;
  password?: string;
  name?: string;

  isOutlineServer = false;

  constructor(accessData: string | ShadowsocksConfig) {
    if (typeof accessData === 'string') {
      this.fromShadowsocksUri(accessData);
    } else {
      this.fromShadowsocksConfig(accessData);
    }
  }

  isEqualTo(that: OutlineServerAccessConfig) {
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

  private fromShadowsocksUri(shadowsocksUri: string) {
    this.isOutlineServer = shadowsocksUri.includes('outline=1');

    let rawConfig;

    try {
      rawConfig = SHADOWSOCKS_URI.parse(shadowsocksUri);
    } catch ({message}) {
      throw new ServerUrlInvalid(message ?? 'Failed to parse access key.');
    }

    if (rawConfig.host.isIPv6) {
      throw new ServerIncompatible('unsupported IPv6 host address');
    }

    if (!OutlineServerAccessConfig.SUPPORTED_CIPHERS.has(rawConfig.method.data)) {
      throw new ShadowsocksUnsupportedCipher(rawConfig.method.data ?? 'unknown');
    }

    this.host = rawConfig.host.data;
    this.port = rawConfig.port.data;
    this.method = rawConfig.method.data;
    this.password = rawConfig.password.data;
    this.name = rawConfig.tag.data;
  }

  private fromShadowsocksConfig({host, port, method, password, name}: ShadowsocksConfig) {
    this.host = host;
    this.port = port;
    this.method = method;
    this.password = password;
    this.name = name;
  }
}
