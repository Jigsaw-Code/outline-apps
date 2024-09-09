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
  type: 'dial';
  host: string;
  port: number;
  dialer?: DialerJson;
}

function newDialEndpointJson(json: unknown): DialEndpointJson {
  if (!(json instanceof Object)) {
    throw new Error(`endpoint config must be an object. Got ${typeof json}`);
  }
  if (!('host' in json)) {
    throw new Error('missing host in endpoint config');
  }
  if (typeof json.host !== 'string') {
    throw new Error(`endpoint host must be a string.  Got ${typeof json.host}`);
  }
  if (!('port' in json)) {
    throw new Error('missing port in endpoint config');
  }
  if (typeof json.port !== 'number') {
    throw new Error(`endpoint port must be a number.  Got ${typeof json.port}`);
  }

  const dialerJson: DialEndpointJson = {
    type: 'dial',
    host: json.host,
    port: json.port,
  };
  if ('dialer' in json) {
    dialerJson.dialer = newDialerJson(json.dialer);
  }
  return dialerJson;
}

type EndpointJson = DialEndpointJson;

function newEndpointJson(json: unknown): EndpointJson {
  if (!(json instanceof Object)) {
    throw new Error(`endpoint config must be an object. Got ${typeof json}`);
  }
  if (!('type' in json)) {
    json = {type: 'dial', ...json};
    throw new Error('endpoint config must have a type');
  }
  switch (json.type) {
    case 'dial':
      return newDialEndpointJson(json);
    default:
      throw new Error(`invalid endpoint type ${json.type}`);
  }
}

interface ShadowsocksDialerJson {
  type: 'shadowsocks';
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
      type: 'shadowsocks',
      endpoint,
      cipher: json.cipher,
      secret: json.secret,
    };
  } else {
    // Legacy format: https://shadowsocks.org/doc/configs.html#config-file.
    if (!('server' in json)) {
      throw new Error('missing Shadowsocks host');
    }
    if (typeof json.server !== 'string') {
      throw new Error(
        `Shadowsocks server must be a string. Got ${typeof json.server}`
      );
    }
    if (!('server_port' in json)) {
      throw new Error('missing Shadowsocks port');
    }
    if (typeof json.server_port !== 'number') {
      throw new Error(
        `Shadowsocks port must be a number. Got ${typeof json.server_port}`
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
      type: 'shadowsocks',
      endpoint: {
        type: 'dial',
        host: json.server,
        port: json.server_port,
      },
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

type DialerJson = PipeDialerJson | ShadowsocksDialerJson;

function newDialerJson(json: unknown): DialerJson {
  if (!(json instanceof Object)) {
    throw new Error(`dialer config must be an object. Got ${typeof json}`);
  }
  // Make Shadowsocks the default if the type is missing, for backwards-compatibility.
  let type = 'shadowsocks';
  if ('type' in json) {
    if (typeof json.type !== 'string') {
      throw new Error('type must be a string');
    }
    type = json.type;
  }
  switch (type) {
    case 'pipe':
      return newPipeDialerJson(json);
    case 'shadowsocks':
      return newShadowsocksDialerJson(json);
    default:
      throw new Error('invalid dialer config');
  }
}

export type TransportConfigJson = DialerJson;
/** TunnelConfigJson represents the configuration to set up a tunnel. */

export interface TunnelConfigJson {
  /** transport describes how to establish connections to the destinations. */
  transport: TransportConfigJson;
}

/** tunnelConfigFromJson creates a TunnelConfigJson from the given JSON object. */
export function newTunnelJson(json: unknown): TunnelConfigJson {
  if (!(json instanceof Object)) {
    throw new Error(`tunnel config must be an object. Got ${typeof json}`);
  }
  if ('transport' in json) {
    return {
      transport: newDialerJson(json.transport),
    };
  } else {
    // Fallback to considering the object a TransportConfig if "transport" is not present.
    return {
      transport: newDialerJson(json),
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
  if ('endpoint' in transport && transport.endpoint.type === 'dial') {
    return net.joinHostPort(
      transport.endpoint.host,
      `${transport.endpoint.port}`
    );
  }
  return undefined;
}

/**
 * getHostFromTransportConfig returns the host of the tunnel server, if there's a meaningful one.
 * This is used by the proxy resolution in Electron.
 */
export function getHostFromTransportConfig(
  transport: TransportConfigJson
): string | undefined {
  if ('endpoint' in transport && transport.endpoint.type === 'dial') {
    return transport.endpoint.host;
  }
  return undefined;
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
  if ('endpoint' in transport && transport.endpoint.type === 'dial') {
    return {...transport, endpoint: {...transport.endpoint, host: newHost}};
  }
}
