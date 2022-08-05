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

import {
  OutlineIpcClient,
  OutlineIpcHandler,
  START_VPN_CHANNEL,
  STOP_VPN_CHANNEL,
  VPN_CONNECTED_CHANNEL,
  VPN_DISCONNECTED_CHANNEL,
  VPN_RECONNECTING_CHANNEL,
} from '../../electron/ipc';
import {ShadowsocksConfig} from './config';
import {Tunnel, TunnelStatus} from './tunnel';

export class ElectronOutlineTunnel implements Tunnel {
  private statusChangeListener: ((status: TunnelStatus) => void) | null = null;

  private running = false;

  constructor(
    public readonly id: string,
    private readonly ipcClient: OutlineIpcClient,
    private readonly ipcHandler: OutlineIpcHandler
  ) {
    // This event is received when the proxy connects. It is mainly used for signaling the UI that
    // the proxy has been automatically connected at startup (if the user was connected at shutdown)
    this.ipcHandler.on(VPN_CONNECTED_CHANNEL, id => {
      if (id === this.id) {
        this.handleStatusChange(TunnelStatus.CONNECTED);
      }
    });
    this.ipcHandler.on(VPN_RECONNECTING_CHANNEL, id => {
      if (id === this.id) {
        this.handleStatusChange(TunnelStatus.RECONNECTING);
      }
    });
  }

  async start(config: ShadowsocksConfig) {
    if (this.running) {
      return Promise.resolve();
    }

    this.ipcHandler.once(VPN_DISCONNECTED_CHANNEL, id => {
      if (id === this.id) {
        this.handleStatusChange(TunnelStatus.DISCONNECTED);
      }
    });

    await this.ipcClient.invoke(START_VPN_CHANNEL, config, this.id);
    this.running = true;
  }

  async stop() {
    if (!this.running) {
      return;
    }

    try {
      await this.ipcClient.invoke(STOP_VPN_CHANNEL);
      this.running = false;
    } catch (e) {
      console.error(`Failed to stop tunnel ${e}`);
    }
  }

  async isRunning(): Promise<boolean> {
    return this.running;
  }

  onStatusChange(listener: (status: TunnelStatus) => void): void {
    this.statusChangeListener = listener;
  }

  private handleStatusChange(status: TunnelStatus) {
    this.running = status === TunnelStatus.CONNECTED;
    if (this.statusChangeListener) {
      this.statusChangeListener(status);
    } else {
      console.error(`${this.id} status changed to ${status} but no listener set`);
    }
  }
}
