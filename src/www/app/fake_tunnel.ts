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

// Note that because this implementation does not emit disconnection events, "switching" between
// servers in the server list will not work as expected.
export class FakeOutlineTunnel implements cordova.plugins.outline.Tunnel {
  private running = false;

  constructor(public config: cordova.plugins.outline.ServerConfig, public id: string) {}

  private playBroken() {
    return this.config.name?.toLowerCase().includes('broken');
  }

  private playUnreachable() {
    return this.config.name?.toLowerCase().includes('unreachable');
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    if (this.playUnreachable()) {
      throw new errors.OutlinePluginError(errors.ErrorCode.SERVER_UNREACHABLE);
    } else if (this.playBroken()) {
      throw new errors.OutlinePluginError(errors.ErrorCode.SHADOWSOCKS_START_FAILURE);
    }

    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }
    this.running = false;
  }

  async isRunning(): Promise<boolean> {
    return this.running;
  }

  async isReachable(): Promise<boolean> {
    return !this.playUnreachable();
  }

  onStatusChange(listener: (status: TunnelStatus) => void): void {
    // NOOP
  }
}
