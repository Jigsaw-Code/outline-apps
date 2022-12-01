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

import * as errors from '../../model/errors';
import * as events from '../../model/events';
import {Server, ServerType} from '../../model/server';

import {NativeNetworking} from '../net';
import {Tunnel, TunnelStatus, ShadowsocksSessionConfig} from '../tunnel';

import {fetchShadowsocksSessionConfig, staticKeyToShadowsocksSessionConfig} from './access_key_serialization';
import {ConfigQueue} from './config_queue';

// PLEASE DON'T use this class outside of this `outline_server_repository` folder!

// ### Do we need this class?
/*
class RecurringCallback {
  // ### doc we used this to avoid scheduling multiple times simultaneously.
  private intervalHandle: ReturnType<typeof setInterval> = null;

  constructor(private readonly intervalMs: number) {}

  async start(callback: any) {
    await callback();
    this.intervalHandle = setInterval(callback, this.intervalMs);
  }
  stop() {
    if (!this.intervalHandle) return;
    clearInterval(this.intervalHandle);
    this.intervalHandle = null;
  }
}
*/

export class OutlineServer implements Server {
  // We restrict to AEAD ciphers because unsafe ciphers are not supported in go-tun2socks.
  // https://shadowsocks.org/en/spec/AEAD-Ciphers.html
  private static readonly SUPPORTED_CIPHERS = ['chacha20-ietf-poly1305', 'aes-128-gcm', 'aes-192-gcm', 'aes-256-gcm'];

  errorMessageId?: string;
  // ### notes
  private configQueue: ConfigQueue = new ConfigQueue();
  private sessionConfig?: ShadowsocksSessionConfig;
  private dynamicConfigInterval: ReturnType<typeof setInterval> = null;

  constructor(
    public readonly id: string,
    public readonly accessKey: string,
    public readonly type: ServerType,
    private _name: string,
    private tunnel: Tunnel,
    private net: NativeNetworking,
    private eventQueue: events.EventQueue
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

  get isOutlineServer() {
    return this.accessKey.includes('outline=1');
  }

  private async startDynamicConfigRefresh() {
    this.stopDynamicConfigRefresh();
    const callback = async () => {
      const sessionConfigs =
        await fetchShadowsocksSessionConfig(this.sessionConfigLocation);
      this.configQueue.updateConfigs(sessionConfigs)
    }
    await callback();
    this.dynamicConfigInterval = setInterval(
      callback, 5 /*min*/ * 60 /*sec/min*/ * 1000 /*ms/sec*/);
  }

  private stopDynamicConfigRefresh() {
    if (!this.dynamicConfigInterval) return;
    clearInterval(this.dynamicConfigInterval);
    this.dynamicConfigInterval = null;
  }

  async connect() {
    // connect() is triggered by a manual user connect action
    // so we must reset the configQueue.
    this.configQueue.reset();
    try {
      if (this.type === ServerType.DYNAMIC_CONNECTION) {
        this.startDynamicConfigRefresh();
        this.sessionConfig = this.configQueue.getConfig();
        // ### check for null!
      }

      await this.tunnel.start(this.sessionConfig);
    } catch (e) {
      // e originates in "native" code: either Cordova or Electron's main process.
      // Because of this, we cannot assume "instanceof OutlinePluginError" will work.
      if (e.errorCode) {
        throw errors.fromErrorCode(e.errorCode);
      }
      throw e;
    }
  }

  async disconnect() {
    this.stopDynamicConfigRefresh();
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

  // NOTE: you should only be calling this method on running servers
  checkReachable(): Promise<boolean> {
    if (!this.sessionConfig) {
      return Promise.resolve(false);
    }

    return this.net.isServerReachable(this.sessionConfig.host, this.sessionConfig.port);
  }

  static isServerCipherSupported(cipher?: string) {
    return cipher !== undefined && OutlineServer.SUPPORTED_CIPHERS.includes(cipher);
  }
}
