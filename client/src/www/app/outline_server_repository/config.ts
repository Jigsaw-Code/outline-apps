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

export const TEST_ONLY = {
  parseAccessKey: parseAccessKey,
  serviceNameFromAccessKey: serviceNameFromAccessKey,
};

/**
 * ServiceConfig represents an Outline service. It's the structured representation of an Access Key.
 * It has a name, a tunnel config that can be statically or dynamically defined.
 */
export type ServiceConfig = StaticServiceConfig | DynamicServiceConfig;

/**
 * StaticServiceConfig is a ServiceConfig with a static tunnel config.
 * It's the structured representation of a Static Access Key.
 */
export class StaticServiceConfig {
  constructor(
    readonly name: string,
    readonly tunnelConfig: TunnelConfigJson
  ) {}
}

/**
 * DynamicServiceConfig is a ServiceConfig that has the location to fetch the tunnel config.
 * It's the structured representation of a Dynamic Access Key.
 */
export class DynamicServiceConfig {
  constructor(
    readonly name: string,
    readonly transportConfigLocation: URL
  ) {}
}

/**
 * TunnelConfigJson represents the configuration to set up a tunnel.
 * This is where VPN-layer parameters would go (e.g. interface IP, routes, dns, etc.).
 */
export interface TunnelConfigJson {
  firstHop: string;
  /** transport describes how to establish connections to the destinations.
   * See https://github.com/Jigsaw-Code/outline-apps/blob/master/client/go/outline/config.go for format. */
  transport: string;
}

/**
 * parseTunnelConfig parses the given tunnel config as text and returns a new TunnelConfigJson.
 * The config text may be a "ss://" link or a JSON object.
 * This is used by the server to parse the config fetched from the dynamic key, and to parse
 * static keys as tunnel configs (which may be present in the dynamic config).
 */
export async function parseTunnelConfig(
  tunnelConfigText: string
): Promise<TunnelConfigJson | null> {
  tunnelConfigText = tunnelConfigText.trim();
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

  // TODO(fortuna): stop converting to the Go format. Let the Go code convert.
  // We don't validate the method because that's already done in the Go code as
  // part of the Dynamic Key connection flow.
  const transport = {
    host: responseJson.server,
    port: responseJson.server_port,
    method: responseJson.method,
    password: responseJson.password,
  };
  if (responseJson.prefix) {
    (transport as {prefix?: string}).prefix = responseJson.prefix;
  }
  return {
    firstHop: net.joinHostPort(transport.host, `${transport.port}`),
    transport: JSON.stringify(transport),
  };
}

/** Parses an access key string into a TunnelConfig object. */
async function staticKeyToTunnelConfig(
  staticKey: string
): Promise<TunnelConfigJson | null> {
  const config = SHADOWSOCKS_URI.parse(staticKey);
  if (!isShadowsocksCipherSupported(config.method.data)) {
    throw new errors.ShadowsocksUnsupportedCipher(
      config.method.data || 'unknown'
    );
  }
  const transport = {
    host: config.host.data,
    port: config.port.data,
    method: config.method.data,
    password: config.password.data,
  };
  if (config.extra?.['prefix']) {
    (transport as {prefix?: string}).prefix = config.extra?.['prefix'];
  }
  return {
    firstHop: net.joinHostPort(transport.host, `${transport.port}`),
    transport: JSON.stringify(transport),
  };
}

export async function parseAccessKey(
  accessKeyText: string
): Promise<ServiceConfig> {
  try {
    const accessKeyUrl = new URL(accessKeyText.trim());

    // The default service name is extracted from the URL fragment of the access key.
    const name = serviceNameFromAccessKey(accessKeyUrl);
    // The hash only encodes service config, not tunnel config or config location.
    const noHashAccessKey = new URL(accessKeyUrl);
    noHashAccessKey.hash = '';

    // Static ss:// keys. It encodes the full service config.
    if (noHashAccessKey.protocol === 'ss:') {
      return new StaticServiceConfig(
        name,
        await parseTunnelConfig(noHashAccessKey.toString())
      );
    }

    // Dynamic ssconf:// keys. It encodes the location of the service config.
    if (
      noHashAccessKey.protocol === 'ssconf:' ||
      noHashAccessKey.protocol === 'https:'
    ) {
      try {
        // URL does not parse the hostname (treats as opaque string) if the protocol is non-standard (e.g. non-http).
        const configLocation = new URL(
          noHashAccessKey.toString().replace(/^ssconf:\/\//, 'https://')
        );
        return new DynamicServiceConfig(name, configLocation);
      } catch (error) {
        throw new errors.ServerUrlInvalid(error.message);
      }
    }

    throw new TypeError('Access Key is not a ss:// or ssconf:// URL');
  } catch (e) {
    throw new errors.ServerAccessKeyInvalid(e);
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
  return SUPPORTED_SHADOWSOCKS_CIPHERS.includes(cipher);
}

/**
 * serviceNameFromAccessKey extracts the service name from the access key.
 * This is done by getting parsing the fragment hash in the URL and returning the
 * entry that is not a key=value pair.
 * This is used to name the service card in the UI when the service is added.
 */
function serviceNameFromAccessKey(accessKey: URL): string | undefined {
  if (!accessKey.hash) return;

  return decodeURIComponent(
    accessKey.hash
      .slice(1)
      .split('&')
      .find(keyValuePair => !keyValuePair.includes('='))
  );
}
