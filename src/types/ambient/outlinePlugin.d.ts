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

// Typings for cordova-plugin-outline

// This enum doesn't logically belong in this file - ideally, it would live in "regular" code (most
// likely somewhere in model). However, since we need to reference it from a typings file, it must
// be defined in a typings file.
//
// Additionally, because this is a typings file, we must declare a *const* enum - regular enums are
// backed, perhaps surprisingly, by a JavaScript object.
declare const enum TunnelStatus { CONNECTED, DISCONNECTED, RECONNECTING }

declare namespace cordova.plugins.outline {
  const log: {
    // Initializes the error reporting framework with the supplied credentials.
    initialize(apiKey: string): Promise<void>;

    // Sends previously captured logs and events to the error reporting
    // framework.
    // Associates the report to the provided unique identifier.
    send(uuid: string): Promise<void>;
  };

  // Quits the application. Only supported in macOS.
  function quitApplication(): void;

  // Represents a Shadowsocks server configuration.
  interface ServerConfig {
    method?: string;
    password?: string;
    host?: string;
    port?: number;
    name?: string;
  }

  // Represents a VPN tunnel to a remote server.
  class Tunnel {
    // Creates a new instance with |serverConfig|.
    // A sequential ID will be generated if |id| is absent.
    constructor(serverConfig: ServerConfig, id?: string);

    config: ServerConfig;

    readonly id: string;

    // Starts the VPN service, and tunnels all the traffic to a local Shadowsocks
    // server as dictated by its configuration. If there is another running
    // instance, broadcasts a disconnect event and stops the running tunnel.
    // In such case, restarts tunneling while preserving the VPN tunnel.
    // Rejects with an OutlinePluginError.
    start(): Promise<void>;

    // Stops the tunnel and VPN service.
    stop(): Promise<void>;

    // Returns whether the tunnel instance is active.
    isRunning(): Promise<boolean>;

    // Returns whether the proxy server is reachable by attempting to establish
    // a socket to the IP and port specified in |config|.
    isReachable(): Promise<boolean>;

    // Sets a listener, to be called when the VPN tunnel status changes.
    onStatusChange(listener: (status: TunnelStatus) => void): void;
  }
}
