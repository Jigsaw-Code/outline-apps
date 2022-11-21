// Copyright 2020 The Outline Authors
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

export interface ShadowsocksSessionConfig {
  host?: string;
  port?: number;
  password?: string;
  method?: string;
  prefix?: string;
}

export const enum TunnelStatus {
  CONNECTED,
  DISCONNECTED,
  RECONNECTING,
}

export type TunnelFactory = (id: string) => Tunnel;

// Represents a VPN tunnel to a Shadowsocks proxy server. Implementations provide native tunneling
// functionality through cordova.plugins.oultine.Tunnel and ElectronOutlineTunnel.
export interface Tunnel {
  // Unique instance identifier.
  readonly id: string;

  // Connects a VPN, routing all device traffic to a Shadowsocks server as dictated by `config`.
  // If there is another running instance, broadcasts a disconnect event and stops the active
  // tunnel. In such case, restarts tunneling while preserving the VPN.
  // Throws OutlinePluginError.
  start(config: ShadowsocksSessionConfig): Promise<void>;

  // Stops the tunnel and VPN service.
  stop(): Promise<void>;

  // Returns whether the tunnel instance is active.
  isRunning(): Promise<boolean>;

  // Sets a listener, to be called when the tunnel status changes.
  onStatusChange(listener: (status: TunnelStatus) => void): void;
}
