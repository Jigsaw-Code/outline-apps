// Copyright 2024 The Outline Authors
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

import * as net from '@outline/infrastructure/net';
import {SHADOWSOCKS_URI} from 'ShadowsocksConfig';

import {TunnelConfig, TransportConfig} from './vpn';
import * as errors from '../../model/errors';

// Parses an access key string into a TunnelConfig object.
export function staticKeyToTunnelConfig(staticKey: string): TunnelConfig {
  try {
    const config = SHADOWSOCKS_URI.parse(staticKey);
    return {
      transport: new TransportConfig({
        host: config.host.data,
        port: config.port.data,
        method: config.method.data,
        password: config.password.data,
        prefix: config.extra?.['prefix'],
      }),
    };
  } catch (cause) {
    throw new errors.ServerAccessKeyInvalid('Invalid static access key.', {
      cause,
    });
  }
}

export function setTransportHost(
  transportConfig: string,
  host: string
): string {
  try {
    const configJson = JSON.parse(transportConfig);
    configJson.host = host;
    return JSON.stringify(configJson);
  } catch {
    // Fallback.
  }
  try {
    const configUrl = new URL(transportConfig);
    const scheme = configUrl.protocol;
    // Javascript doesn't parse the fields if the scheme is not http or https.
    configUrl.protocol = 'http';
    // URL doesn't allow setting the hostname field, only host (which is host:port).
    configUrl.host = net.joinHostPort(host, configUrl.port);
    configUrl.protocol = scheme;
    return configUrl.toString();
  } catch {
    // Fallback.
  }
  return undefined;
}

export function validateStaticKey(staticKey: string) {
  let config = null;
  try {
    config = SHADOWSOCKS_URI.parse(staticKey);
  } catch (error) {
    throw new errors.ServerUrlInvalid(
      error.message || 'failed to parse access key'
    );
  }
  if (!isShadowsocksCipherSupported(config.method.data)) {
    throw new errors.ShadowsocksUnsupportedCipher(
      config.method.data || 'unknown'
    );
  }
}

// We only support AEAD ciphers for Shadowsocks.
// See https://shadowsocks.org/en/spec/AEAD-Ciphers.html
const SUPPORTED_SHADOWSOCKS_CIPHERS = [
  'chacha20-ietf-poly1305',
  'aes-128-gcm',
  'aes-192-gcm',
  'aes-256-gcm',
];

function isShadowsocksCipherSupported(cipher?: string): boolean {
  return cipher !== undefined && SUPPORTED_SHADOWSOCKS_CIPHERS.includes(cipher);
}
