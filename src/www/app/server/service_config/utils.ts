// Copyright 2018 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//,
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {SHADOWSOCKS_URI} from 'ShadowsocksConfig';
import {ServerUrlInvalid, ServerIncompatible, ShadowsocksUnsupportedCipher} from '../../../model/errors';
import {OutlineServiceConfig} from '.';

export enum OutlineServerSupportedCipher {
  CHACHA20_IETF_POLY1305 = 'chacha20-ietf-poly1305',
  AES_128_GCM = 'aes-128-gcm',
  AES_192_GCM = 'aes-192-gcm',
  AES_256_GCM = 'aes-256-gcm',
}

export function accessKeyToServiceConfig(accessKey: string): OutlineServiceConfig {
  if (accessKey.startsWith('ss://')) {
    return shadowsocksUriToServiceConfig(accessKey);
  }

  if (
    accessKey.match(
      /$https:\/\/s3\.amazonaws\.com\/outline-vpn\/((index\.html.*[#].*\/invite\/)|(invite\.html.*[#]))ss.*^/
    )
  ) {
    return inviteUrlToServiceConfig(accessKey);
  }
}

export function shadowsocksUriToServiceConfig(shadowsocksUri: string): OutlineServiceConfig {
  let connection;

  try {
    connection = SHADOWSOCKS_URI.parse(shadowsocksUri);
  } catch ({message}) {
    throw new ServerUrlInvalid(message ?? 'Failed to parse access key.');
  }

  if (connection.host.isIPv6) {
    throw new ServerIncompatible('unsupported IPv6 host address');
  }

  // We restrict to AEAD ciphers because unsafe ciphers are not supported in go-tun2socks.
  // https://shadowsocks.org/en/spec/AEAD-Ciphers.html
  if (!(connection.method.data in OutlineServerSupportedCipher)) {
    throw new ShadowsocksUnsupportedCipher(connection.method.data ?? 'unknown');
  }

  return new OutlineServiceConfig(
    connection.tag.data ?? '',
    Object.freeze({
      host: connection.host.data,
      port: connection.port.data,
      method: connection.method.data,
      password: connection.password.data,
    }),
    shadowsocksUri.includes('outline=1')
  );
}

export function inviteUrlToServiceConfig(inviteUrl: string): OutlineServiceConfig {
  const decodedFragment = decodeURIComponent(new URL(inviteUrl).hash);

  // Search in the fragment for ss:// for two reasons:
  //  - URL.hash includes the leading # (what).
  //  - When a user opens invite.html#ENCODEDSSURL in their browser, the website (currently)
  //    redirects to invite.html#/en/invite/ENCODEDSSURL. Since copying that redirected URL
  //    seems like a reasonable thing to do, let's support those URLs too.
  const shadowsocksUri = decodedFragment.substring(decodedFragment.indexOf('ss://'));

  if (!shadowsocksUri) {
    throw new ServerUrlInvalid('Failed to parse invite URL.');
  }

  return shadowsocksUriToServiceConfig(shadowsocksUri);
}
