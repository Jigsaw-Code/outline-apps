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

interface DialEndpointJson {
  address: string;
  dialer?: DialerJson;
}

function newDialEndpointJson(json: unknown): DialEndpointJson {
  if (typeof json === 'string') {
    return newDialEndpointJson({dial: {address: json}});
  }
  if (!(json instanceof Object)) {
    throw new Error(`endpoint config must be an object. Got ${typeof json}`);
  }
  if (!('address' in json)) {
    throw new Error('missing address in endpoint config');
  }
  if (typeof json.address !== 'string') {
    throw new Error(
      `endpoint address must be a string.  Got ${typeof json.address}`
    );
  }

  const dialerJson: DialEndpointJson = {
    address: json.address,
  };
  if ('dialer' in json) {
    dialerJson.dialer = newDialerJson(json.dialer);
  }
  return dialerJson;
}

type EndpointJson = {
  dial: DialEndpointJson;
};

function newEndpointJson(json: unknown): EndpointJson {
  if (!(json instanceof Object)) {
    throw new Error(`endpoint config must be an object. Got ${typeof json}`);
  }
  if ('dial' in json) {
    return {dial: newDialEndpointJson(json.dial)};
  } else {
    throw new Error('invalid endpoint config');
  }
}

interface ShadowsocksDialerJson {
  endpoint: EndpointJson;
  cipher: string;
  secret: string;
  prefix_bytes?: string; // base64.
}

function newShadowsocksDialerJson(json: unknown): ShadowsocksDialerJson {
  if (!(json instanceof Object)) {
    throw new Error(`dialer config must be an object. Got ${typeof json}`);
  }

  if ('endpoint' in json) {
    const endpoint = newEndpointJson(json.endpoint);
    if (!('cipher' in json)) {
      throw new Error('missing Shadowsocks cipher');
    }
    if (typeof json.cipher !== 'string') {
      throw new Error(
        `Shadowsocks cipher must be a string. Got ${typeof json.cipher}`
      );
    }
    if (!('secret' in json)) {
      throw new Error('missing Shadowsocks secret');
    }
    if (typeof json.secret !== 'string') {
      throw new Error(
        `Shadowsocks secret must be a string. Got ${typeof json.secret}`
      );
    }
    return {
      endpoint,
      cipher: json.cipher,
      secret: json.secret,
    };
  } else {
    // Legacy format.
    if (!('host' in json)) {
      throw new Error('missing Shadowsocks host');
    }
    if (typeof json.host !== 'string') {
      throw new Error(
        `Shadowsocks host must be a string. Got ${typeof json.host}`
      );
    }
    if (!('port' in json)) {
      throw new Error('missing Shadowsocks port');
    }
    if (typeof json.port !== 'string') {
      throw new Error(
        `Shadowsocks port must be a string. Got ${typeof json.port}`
      );
    }
    if (!('method' in json)) {
      throw new Error('missing Shadowsocks method');
    }
    if (typeof json.method !== 'string') {
      throw new Error(
        `Shadowsocks cipher must be a string. Got ${typeof json.method}`
      );
    }
    if (!('password' in json)) {
      throw new Error('missing Shadowsocks password');
    }
    if (typeof json.password !== 'string') {
      throw new Error(
        `Shadowsocks password must be a string. Got ${typeof json.password}`
      );
    }
    return {
      endpoint: {dial: {address: net.joinHostPort(json.host, json.port)}},
      cipher: json.method,
      secret: json.password,
    };
  }
  // TODO(fortuna): Add prefix;
}

type PipeDialerJson = DialerJson[];

function newPipeDialerJson(json: unknown): PipeDialerJson {
  if (!(json instanceof Array)) {
    throw new Error(`pipe dialer config must be a list. Got ${typeof json}`);
  }
  return json.map(newDialerJson);
}

type DialerJson =
  | {
      pipe: PipeDialerJson;
    }
  | {
      shadowsocks: ShadowsocksDialerJson;
    };

function newDialerJson(json: unknown): DialerJson {
  if (!(json instanceof Object)) {
    throw new Error(`dialer config must be an object. Got ${typeof json}`);
  }
  if ('pipe' in json) {
    return {pipe: newPipeDialerJson(json.pipe)};
  } else if ('shadowsocks' in json) {
    return {shadowsocks: newShadowsocksDialerJson(json)};
  } else {
    throw new Error('invalid dialer config');
  }
}

export type TransportConfigJson = DialerJson;
/** TunnelConfigJson represents the configuration to set up a tunnel. */

export interface TunnelConfigJson {
  /** transport describes how to establish connections to the destinations. */
  transport: TransportConfigJson;
}

function newTransportJson(json: unknown): TransportConfigJson {
  if (!(json instanceof Object)) {
    throw new Error(`transport config must be an object. Got ${typeof json}`);
  }
  try {
    return newDialerJson(json);
  } catch (e) {
    try {
      // Try as Shadowsocks as a fallback.
      return {
        shadowsocks: newShadowsocksDialerJson(json),
      };
    } catch {
      throw e;
    }
  }
}

/** tunnelConfigFromJson creates a TunnelConfigJson from the given JSON object. */
export function newTunnelJson(json: unknown): TunnelConfigJson {
  if (!(json instanceof Object)) {
    throw new Error(`tunnel config must be an object. Got ${typeof json}`);
  }
  if ('transport' in json) {
    return {
      transport: newTransportJson(json.transport),
    };
  } else {
    // Fallback to considering the object a TransportConfig if "transport" is not present.
    return {
      transport: newTransportJson(json),
    };
  }
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
  // TODO: extract from shadowsocks.
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
