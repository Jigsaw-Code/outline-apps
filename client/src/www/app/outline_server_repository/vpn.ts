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

export const enum TunnelStatus {
  CONNECTED,
  DISCONNECTED,
  RECONNECTING,
  DISCONNECTING,
}

export type TransportConfigJson = object;

/** TunnelConfigJson represents the configuration to set up a tunnel. */
export interface TunnelConfigJson {
  /** transport describes how to establish connections to the destinations.
   * See https://github.com/Jigsaw-Code/outline-apps/blob/master/client/go/outline/config.go for format. */
  transport: TransportConfigJson;
  // This is the place where routing configuration would go.
}

/** StartRequestJson is the serializable request to start the VPN, used for persistence and IPCs. */
export interface StartRequestJson {
  id: string;
  name: string;
  config: TunnelConfigJson;
}

/** VpnApi is how we talk to the platform-specific VPN API. */
export interface VpnApi {
  /**
   * Connects a VPN, routing all device traffic as described in the SessionConfig.
   * If there is another running instance, broadcasts a disconnect event and stops the active
   * tunnel. In such case, restarts tunneling while preserving the VPN.
   * @throws {OutlinePluginError}
   */
  start(request: StartRequestJson): Promise<void>;

  /** Stops the tunnel and VPN service. */
  stop(id: string): Promise<void>;

  /** Returns whether the tunnel instance is active. */
  isRunning(id: string): Promise<boolean>;

  /** Sets a listener, to be called when the tunnel status changes. */
  onStatusChange(listener: (id: string, status: TunnelStatus) => void): void;
}
