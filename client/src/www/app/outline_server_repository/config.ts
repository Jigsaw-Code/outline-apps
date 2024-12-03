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

import {SHADOWSOCKS_URI} from 'ShadowsocksConfig';

import * as errors from '../../model/errors';
import { getDefaultMethodChannel } from '../method_channel';

export const TEST_ONLY = {
  getAddressFromTransportConfig: getAddressFromTransportConfig,
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

/** EndpointAddress represents the address of a TCP/UDP endpoint. */
class EndpointAddress {
  readonly host: string;
  readonly port: number | undefined;
}

/**
 * TunnelConfigJson represents the configuration to set up a tunnel.
 * This is where VPN-layer parameters would go (e.g. interface IP, routes, dns, etc.).
 */
export interface TunnelConfigJson {
  firstHop: EndpointAddress | undefined;
  /** transport describes how to establish connections to the destinations.
   * See https://github.com/Jigsaw-Code/outline-apps/blob/master/client/go/outline/config.go for format. */
  transport: TransportConfigJson;
}

/**
 * TransportConfigJson represents the transport to be used.
 * Application code should treat it as opaque, as it's handled by the networking layer.
 */
export type TransportConfigJson = object;

/**
 * getAddressFromTransportConfig returns the address of the tunnel server, if there's a meaningful one.
 * This is used to show the server address in the UI when connected.
 */
function getAddressFromTransportConfig(
  transport: TransportConfigJson
): EndpointAddress | undefined {
  const hostConfig: {host?: string; port?: number} = transport;
  if (hostConfig.host) {
    return {host: hostConfig.host, port: hostConfig?.port};
  } else {
    return undefined;
  }
}

/**
 * setTransportConfigHost returns a new TransportConfigJson with the given host as the tunnel server.
 * Should only be set if getHostFromTransportConfig returns one.
 * This is used by the proxy resolution in Electron.
 */
// TODO(fortuna): Move config parsing to Go and do the DNS resolution and IP injection for Electron there.
export function setTransportConfigHost(
  transport: TransportConfigJson,
  newHost: string
): TransportConfigJson | undefined {
  if (!('host' in transport)) {
    return undefined;
  }
  return {...transport, host: newHost};
}

/**
 * parseTunnelConfig parses the given tunnel config as text and returns a new TunnelConfigJson.
 * The config text may be a "ss://" link or a JSON object.
 * This is used by the server to parse the config fetched from the dynamic key, and to parse
 * static keys as tunnel configs (which may be present in the dynamic config).
 */
export function parseTunnelConfig(
  tunnelConfigText: string
): TunnelConfigJson | null {
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
    firstHop: getAddressFromTransportConfig(transport),
  };
}

/** Parses an access key string into a TunnelConfig object. */
function staticKeyToTunnelConfig(staticKey: string): TunnelConfigJson {
  const config = SHADOWSOCKS_URI.parse(staticKey);
  if (!isShadowsocksCipherSupported(config.method.data)) {
    throw new errors.ShadowsocksUnsupportedCipher(
      config.method.data || 'unknown'
    );
  }
  const transport: TransportConfigJson = {
    host: config.host.data,
    port: config.port.data,
    method: config.method.data,
    password: config.password.data,
  };
  if (config.extra?.['prefix']) {
    (transport as {prefix?: string}).prefix = config.extra?.['prefix'];
  }
  return {
    transport,
    firstHop: getAddressFromTransportConfig(transport),
  };
}

export function parseAccessKey(accessKey: string): ServiceConfig {
  try {
    accessKey = accessKey.trim();

    // The default service name is extracted from the URL fragment of the access key.
    const name = serviceNameFromAccessKey(accessKey);

    // Static ss:// keys. It encodes the full service config.
    if (accessKey.startsWith('ss://')) {
      return new StaticServiceConfig(name, parseTunnelConfig(accessKey));
    }

    // Dynamic ssconf:// keys. It encodes the location of the service config.
    if (accessKey.startsWith('ssconf://') || accessKey.startsWith('https://')) {
      try {
        // URL does not parse the hostname (treats as opaque string) if the protocol is non-standard (e.g. non-http).
        const configLocation = new URL(
          accessKey.replace(/^ssconf:\/\//, 'https://')
        );
        return new DynamicServiceConfig(name, configLocation);
      } catch (error) {
        throw new errors.ServerUrlInvalid(error.message);
      }
    }

    throw new TypeError('Access Key is not a ss:// or ssconf:// URL');
  } catch (e) {
    throw new errors.ServerAccessKeyInvalid('Invalid static access key.', {
      cause: e,
    });
  }
}

export function validateAccessKey(accessKey: string) {
  parseAccessKey(accessKey);
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
function serviceNameFromAccessKey(accessKey: string): string | undefined {
  const {hash} = new URL(accessKey.replace(/^ss(?:conf)?:\/\//, 'https://'));

  if (!hash) return;

  return decodeURIComponent(
    hash
      .slice(1)
      .split('&')
      .find(keyValuePair => !keyValuePair.includes('='))
  );
}
