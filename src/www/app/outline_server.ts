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

/// <reference path='../../types/ambient/outlinePlugin.d.ts'/>

import * as errors from '../model/errors';
import * as events from '../model/events';
import {Server} from '../model/server';

import {PersistentServer} from './persistent_server';

export class OutlineServer implements PersistentServer {
  // We restrict to AEAD ciphers because unsafe ciphers are not supported in go-tun2socks.
  // https://shadowsocks.org/en/spec/AEAD-Ciphers.html
  private static readonly SUPPORTED_CIPHERS =
      ['chacha20-ietf-poly1305', 'aes-128-gcm', 'aes-192-gcm', 'aes-256-gcm'];

  constructor(
      public readonly id: string, public config: cordova.plugins.outline.ServerConfig,
      private connection: cordova.plugins.outline.Connection,
      private eventQueue: events.EventQueue) {
    this.connection.onStatusChange((status: ConnectionStatus) => {
      let statusEvent: events.OutlineEvent;
      switch (status) {
        case ConnectionStatus.CONNECTED:
          statusEvent = new events.ServerConnected(this);
          break;
        case ConnectionStatus.DISCONNECTED:
          statusEvent = new events.ServerDisconnected(this);
          break;
        case ConnectionStatus.RECONNECTING:
          statusEvent = new events.ServerReconnecting(this);
          break;
        default:
          console.warn(`Received unknown connection status ${status}`);
          return;
      }
      eventQueue.enqueue(statusEvent);
    });
  }

  get name() {
    return this.config.name || this.config.host || '';
  }

  set name(newName: string) {
    this.config.name = newName;
  }

  get host() {
    return this.config.host;
  }

  connect(): Promise<void> {
    return this.connection.start().catch((e) => {
      // e originates in "native" code: either Cordova or Electron's main process.
      // Because of this, we cannot assume "instanceof OutlinePluginError" will work.
      if (e.errorCode) {
        throw errors.fromErrorCode(e.errorCode);
      }
      throw e;
    });
  }

  disconnect(): Promise<void> {
    return this.connection.stop().catch((e) => {
      // TODO: None of the plugins currently return an ErrorCode on disconnection.
      throw new errors.RegularNativeError();
    });
  }

  checkRunning(): Promise<boolean> {
    return this.connection.isRunning();
  }

  checkReachable(): Promise<boolean> {
    return this.connection.isReachable();
  }

  public static isServerCipherSupported(cipher?: string) {
    return cipher !== undefined && OutlineServer.SUPPORTED_CIPHERS.includes(cipher);
  }
}
