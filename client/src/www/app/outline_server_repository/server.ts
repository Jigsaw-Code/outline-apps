// Copyright 2018 The Outline Authors
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

import {Localizer} from '@outline/infrastructure/i18n';

import {fetchShadowsocksSessionConfig, staticKeyToShadowsocksSessionConfig} from './access_key_serialization';
import * as errors from '../../model/errors';
import * as events from '../../model/events';
import {PlatformError} from '../../model/platform_error';
import {Server, ServerType} from '../../model/server';


// PLEASE DON'T use this class outside of this `outline_server_repository` folder!

export class OutlineServer implements Server {
  // We restrict to AEAD ciphers because unsafe ciphers are not supported in go-tun2socks.
  // https://shadowsocks.org/en/spec/AEAD-Ciphers.html
  private static readonly SUPPORTED_CIPHERS = ['chacha20-ietf-poly1305', 'aes-128-gcm', 'aes-192-gcm', 'aes-256-gcm'];

  errorMessageId?: string;
  private sessionConfig?: ShadowsocksSessionConfig;

  constructor(
    private tunnel: PlatformTunnel,
    readonly id: string,
    readonly accessKey: string,
    readonly type: ServerType,
    private _name: string,
    eventQueue: events.EventQueue,
    localize: Localizer,
  ) {
    switch (this.type) {
      case ServerType.DYNAMIC_CONNECTION:
        this.accessKey = accessKey.replace(/^ssconf:\/\//, 'https://');
        break;
      case ServerType.STATIC_CONNECTION:
      default:
        this.sessionConfig = staticKeyToShadowsocksSessionConfig(accessKey);
        break;
    }
    if (!_name) {
      if (this.sessionConfigLocation) {
        this._name = this.sessionConfigLocation.port === '443'
          ? this.sessionConfigLocation.hostname
          : `${this.sessionConfigLocation.hostname}:${this.sessionConfigLocation.port}`;
      } else {
        this._name = localize(this.accessKey.includes('outline=1') ? 'server-default-name-outline' : 'server-default-name');
      }
    }

    this.tunnel.onStatusChange((status: TunnelStatus) => {
      let statusEvent: events.OutlineEvent;
      switch (status) {
        case TunnelStatus.CONNECTED:
          statusEvent = new events.ServerConnected(this);
          break;
        case TunnelStatus.DISCONNECTED:
          statusEvent = new events.ServerDisconnected(this);
          break;
        case TunnelStatus.RECONNECTING:
          statusEvent = new events.ServerReconnecting(this);
          break;
        default:
          console.warn(`Received unknown tunnel status ${status}`);
          return;
      }
      eventQueue.enqueue(statusEvent);
    });
  }

  get name() {
    return this._name;
  }

  set name(newName: string) {
    this._name = newName;
  }

  get address() {
    if (!this.sessionConfig) return '';

    return `${this.sessionConfig.host}:${this.sessionConfig.port}`;
  }

  get sessionConfigLocation() {
    if (this.type !== ServerType.DYNAMIC_CONNECTION) {
      return;
    }

    return new URL(this.accessKey);
  }

  async connect() {
    if (this.type === ServerType.DYNAMIC_CONNECTION) {
      this.sessionConfig = await fetchShadowsocksSessionConfig(this.sessionConfigLocation);
    }

    try {
      await this.tunnel.start(this.name, this.sessionConfig);
    } catch (cause) {
      // TODO(junyi): Remove the catch above once all platforms are migrated to PlatformError
      if (cause instanceof PlatformError) {
        throw cause;
      }

      // e originates in "native" code: either Cordova or Electron's main process.
      // Because of this, we cannot assume "instanceof OutlinePluginError" will work.
      if (cause.errorCode) {
        throw errors.fromErrorCode(cause.errorCode);
      }

      throw new errors.ProxyConnectionFailure(`Failed to connect to server ${this.name}.`, {cause});
    }
  }

  async disconnect() {
    try {
      await this.tunnel.stop();

      if (this.type === ServerType.DYNAMIC_CONNECTION) {
        this.sessionConfig = undefined;
      }
    } catch (e) {
      // All the plugins treat disconnection errors as ErrorCode.UNEXPECTED.
      throw new errors.RegularNativeError();
    }
  }

  checkRunning(): Promise<boolean> {
    return this.tunnel.isRunning();
  }

  static isServerCipherSupported(cipher?: string) {
    return cipher !== undefined && OutlineServer.SUPPORTED_CIPHERS.includes(cipher);
  }
}


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

export type TunnelFactory = (id: string) => PlatformTunnel;

// Represents a VPN tunnel to a Shadowsocks proxy server. Implementations provide native tunneling
// functionality through cordova.plugins.oultine.Tunnel and ElectronOutlineTunnel.
export interface PlatformTunnel {
  // Unique instance identifier.
  readonly id: string;

  // Connects a VPN, routing all device traffic to a Shadowsocks server as dictated by `config`.
  // If there is another running instance, broadcasts a disconnect event and stops the active
  // tunnel. In such case, restarts tunneling while preserving the VPN.
  // Throws OutlinePluginError.
  start(name: string, config: ShadowsocksSessionConfig): Promise<void>;

  // Stops the tunnel and VPN service.
  stop(): Promise<void>;

  // Returns whether the tunnel instance is active.
  isRunning(): Promise<boolean>;

  // Sets a listener, to be called when the tunnel status changes.
  onStatusChange(listener: (status: TunnelStatus) => void): void;
}
