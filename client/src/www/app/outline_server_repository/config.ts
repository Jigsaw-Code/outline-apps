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

import * as errors from '../../model/errors';

export type TransportConfigJson = object;

/** TunnelConfigJson represents the configuration to set up a tunnel. */
export interface TunnelConfigJson {
  /** transport describes how to establish connections to the destinations.
   * See https://github.com/Jigsaw-Code/outline-apps/blob/master/client/go/outline/config.go for format. */
  transport: TransportConfigJson;
}

/**
 * getAddressFromTransportConfig returns the address of the tunnel server, if there's a meaningful one.
 * This is used to show the server address in the UI when connected.
 */
export function getAddressFromTransportConfig(
  transport: TransportConfigJson
): string | undefined {
  const hostConfig: {host?: string; port?: string} = transport;
  if (hostConfig.host && hostConfig.port) {
    return net.joinHostPort(hostConfig.host, hostConfig.port);
  } else if (hostConfig.host) {
    return hostConfig.host;
  } else {
    return undefined;
  }
}

/**
 * getHostFromTransportConfig returns the host of the tunnel server, if there's a meaningful one.
 * This is used by the proxy resolution in Electron.
 */
export function getHostFromTransportConfig(
  transport: TransportConfigJson
): string | undefined {
  return (transport as unknown as {host: string | undefined}).host;
}

/**
 * setTransportConfigHost returns a new TransportConfigJson with the given host as the tunnel server.
 * Should only be set if getHostFromTransportConfig returns one.
 * This is used by the proxy resolution in Electron.
 */
export function setTransportConfigHost(
  transport: TransportConfigJson,
  newHost: string
): TransportConfigJson | undefined {
  if (!('host' in transport)) {
    return undefined;
  }
  return {...transport, host: newHost};
}

export function parseTunnelConfig(
  tunnelConfigText: string
): TunnelConfigJson | null {
  if (tunnelConfigText.startsWith('ss://')) {
    return staticKeyToTunnelConfig(tunnelConfigText);
  }

  const responseJson = JSON.parse(tunnelConfigText);

  if ('error' in responseJson) {
    throw new errors.SessionProviderError(
      responseJson.error.message,
      responseJson.error.details
    );
  }

  const transport: TransportConfigJson = {
    host: responseJson.server,
    port: responseJson.server_port,
    method: responseJson.method,
    password: responseJson.password,
  };
  if (responseJson.prefix) {
    (transport as {prefix?: string}).prefix = responseJson.prefix;
  }
  return {
    transport,
  };
}

/** Parses an access key string into a TunnelConfig object. */
export function staticKeyToTunnelConfig(staticKey: string): TunnelConfigJson {
  try {
    const config = SHADOWSOCKS_URI.parse(staticKey);
    return {
      transport: {
        host: config.host.data,
        port: config.port.data,
        method: config.method.data,
        password: config.password.data,
        prefix: config.extra?.['prefix'],
      },
    };
  } catch (cause) {
    throw new errors.ServerAccessKeyInvalid('Invalid static access key.', {
      cause,
    });
  }
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

export function isShadowsocksCipherSupported(cipher?: string): boolean {
  return cipher !== undefined && SUPPORTED_SHADOWSOCKS_CIPHERS.includes(cipher);
}

// TODO(daniellacosse): write unit tests for these functions
// Determines if the key is expected to be a url pointing to an ephemeral session config.
export function isDynamicAccessKey(accessKey: string): boolean {
  return accessKey.startsWith('ssconf://') || accessKey.startsWith('https://');
}

// NOTE: For extracting a name that the user has explicitly set, only.
// (Currenly done by setting the hash on the URI)
export function serverNameFromAccessKey(accessKey: string): string | undefined {
  const {hash} = new URL(accessKey.replace(/^ss(?:conf)?:\/\//, 'https://'));

  if (!hash) return;

  return decodeURIComponent(
    hash
      .slice(1)
      .split('&')
      .find(keyValuePair => !keyValuePair.includes('='))
  );
}
