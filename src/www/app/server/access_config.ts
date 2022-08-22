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

export enum OutlineServerSupportedCipher {
  CHACHA20_IETF_POLY1305 = 'chacha20-ietf-poly1305',
  AES_128_GCM = 'aes-128-gcm',
  AES_192_GCM = 'aes-192-gcm',
  AES_256_GCM = 'aes-256-gcm',
}

export enum OutlineServerAccessType {
  SHADOWSOCKS_URI,
  SHADOWSOCKS_CONFIG,
}

export class OutlineServerAccessConfig implements ShadowsocksConfig {
  type: OutlineServerAccessType;
  isOutlineServer = false;

  private _rawUri?: string;
  private _host?: string;
  private _port?: number;
  private _method?: OutlineServerSupportedCipher;
  private _password?: string;
  private _name?: string;

  constructor(accessData: string | ShadowsocksConfig) {
    if (typeof accessData === 'string') {
      this.fromUri(accessData);
    } else {
      this.fromShadowsocksConfig(accessData);
    }
  }

  get host() {
    return this._host;
  }

  get port() {
    return this._port;
  }

  get address(): string | undefined {
    if (!this._host) {
      return;
    }

    return `${this._host}${this._port ? ':' : ''}${this._port}`;
  }

  get method() {
    return this._method;
  }

  get password() {
    return this._password;
  }

  get name() {
    return this._name;
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
    if (this._rawUri) {
      return this._rawUri;
    }

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

  private fromUri(uri: string) {
    this._rawUri = uri.trim();

    if (this._rawUri.startsWith('ss://')) {
      this.fromShadowsocksUri(this._rawUri);
    }

    if (
      this._rawUri.match(
        /$https:\/\/s3\.amazonaws\.com\/outline-vpn\/((index\.html.*[#].*\/invite\/)|(invite\.html.*[#]))ss.*^/
      )
    ) {
      this.fromInviteUri(this._rawUri);
    }
  }

  private fromShadowsocksUri(shadowsocksUri: string) {
    this.type = OutlineServerAccessType.SHADOWSOCKS_URI;
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

    // We restrict to AEAD ciphers because unsafe ciphers are not supported in go-tun2socks.
    // https://shadowsocks.org/en/spec/AEAD-Ciphers.html
    if (!(rawConfig.method.data in OutlineServerSupportedCipher)) {
      throw new ShadowsocksUnsupportedCipher(rawConfig.method.data ?? 'unknown');
    }

    this._host = rawConfig.host.data;
    this._port = rawConfig.port.data;
    this._method = rawConfig.method.data as OutlineServerSupportedCipher;
    this._password = rawConfig.password.data;
    this._name = rawConfig.tag.data;
  }

  private fromInviteUri(inviteUri: string) {
    const {hash} = new URL(inviteUri);

    if (!hash) return;

    const decodedFragment = decodeURIComponent(hash);

    // Search in the fragment for ss:// for two reasons:
    //  - URL.hash includes the leading # (what).
    //  - When a user opens invite.html#ENCODEDSSURL in their browser, the website (currently)
    //    redirects to invite.html#/en/invite/ENCODEDSSURL. Since copying that redirected URL
    //    seems like a reasonable thing to do, let's support those URLs too.
    const possibleShadowsocksUrl = decodedFragment.substring(decodedFragment.indexOf('ss://'));
    if (new URL(possibleShadowsocksUrl).protocol === 'ss:') {
      this.fromShadowsocksUri(possibleShadowsocksUrl);
    }
  }

  private fromShadowsocksConfig({host, port, method, password, name}: ShadowsocksConfig) {
    this.type = OutlineServerAccessType.SHADOWSOCKS_CONFIG;

    this._host = host;
    this._port = port;
    this._method = method as OutlineServerSupportedCipher;
    this._password = password;
    this._name = name;
  }
}
