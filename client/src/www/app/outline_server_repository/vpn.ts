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

export interface TunnelConfig {
  transport: TransportConfig;
}

export class TransportConfig {
  constructor(private readonly json: object) {}

  getAddress(): string | undefined {
    const hostConfig = this.json as {host?: string; port?: string};
    if (hostConfig.host && hostConfig.port) {
      return net.joinHostPort(hostConfig.host, hostConfig.port);
    } else {
      return undefined;
    }
  }

  getHost(): string | undefined {
    return (this.json as {host: string})?.host;
  }

  setHost(newHost: string): TransportConfig | undefined {
    if (!('host' in this.json)) {
      return undefined;
    }
    const newJson = {
      ...this.json,
      host: newHost,
    };
    return new TransportConfig(newJson);
  }

  toString() {
    return JSON.stringify(this.json);
  }
}

export const enum TunnelStatus {
  CONNECTED,
  DISCONNECTED,
  RECONNECTING,
  DISCONNECTING,
}

// VpnApi is how we talk to the platform-specific VPN API.
export interface VpnApi {
  // Connects a VPN, routing all device traffic as described in the SessionConfig.
  // If there is another running instance, broadcasts a disconnect event and stops the active
  // tunnel. In such case, restarts tunneling while preserving the VPN.
  // @throws {OutlinePluginError}
  start(id: string, name: string, config: TunnelConfig): Promise<void>;

  // Stops the tunnel and VPN service.
  stop(id: string): Promise<void>;

  // Returns whether the tunnel instance is active.
  isRunning(id: string): Promise<boolean>;

  // Sets a listener, to be called when the tunnel status changes.
  onStatusChange(listener: (id: string, status: TunnelStatus) => void): void;
}
