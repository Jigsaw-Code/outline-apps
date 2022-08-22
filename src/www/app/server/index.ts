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
import {Server} from '../../model/server';

import {NativeNetworking} from '../net';
import {Tunnel, TunnelStatus} from '../tunnel';

import {OutlineServerAccessConfig} from './access_config';

export class OutlineServer implements Server {
  errorMessageId?: string;

  constructor(
    public readonly id: string,
    public readonly accessConfig: OutlineServerAccessConfig,
    private _name: string,
    private tunnel: Tunnel,
    private net: NativeNetworking,
    private eventQueue: events.EventQueue
  ) {
    this.tunnel.onStatusChange(this.handleTunnelStatusChange);
  }

  get name() {
    return this._name ?? this.accessConfig.name;
  }

  set name(newName: string) {
    this._name = newName;
  }

  get address(): string | undefined {
    return this.accessConfig.address;
  }

  get isOutlineServer() {
    return this.accessConfig.isOutlineServer;
  }

  async connect() {
    try {
      await this.tunnel.start(this.accessConfig);
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
    try {
      await this.tunnel.stop();
    } catch (e) {
      // All the plugins treat disconnection errors as ErrorCode.UNEXPECTED.
      throw new errors.RegularNativeError();
    }
  }

  async checkRunning(): Promise<boolean> {
    return this.tunnel.isRunning();
  }

  async checkReachable(): Promise<boolean> {
    return this.net.isServerReachable(this.accessConfig.host, this.accessConfig.port);
  }

  private handleTunnelStatusChange(status: TunnelStatus) {
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
        console.warn(`Received unknown tunnel status ${status}.`);
        return;
    }

    this.eventQueue.enqueue(statusEvent);
  }
}
