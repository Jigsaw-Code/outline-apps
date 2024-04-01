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

import * as errors from '../model/errors';

import {Tunnel, TunnelStatus, ShadowsocksSessionConfig} from './tunnel';

// Fake Tunnel implementation for demoing and testing.
// Note that because this implementation does not emit disconnection events, "switching" between
// servers in the server list will not work as expected.
export class FakeOutlineTunnel implements Tunnel {
  private running = false;

  constructor(public readonly id: string) {}

  private playBroken(hostname?: string) {
    return hostname?.toLowerCase().includes('broken');
  }

  private playUnreachable(hostname?: string) {
    return hostname?.toLowerCase().includes('unreachable');
  }

  async start(config: ShadowsocksSessionConfig): Promise<void> {
    if (this.running) {
      return;
    }

    if (this.playUnreachable(config.host)) {
      throw new errors.OutlinePluginError(errors.ErrorCode.SERVER_UNREACHABLE);
    } else if (this.playBroken(config.host)) {
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

  onStatusChange(_listener: (status: TunnelStatus) => void): void {
    // NOOP
  }
}
