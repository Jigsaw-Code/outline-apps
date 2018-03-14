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

/// <reference path='../types/outlinePlugin.d.ts'/>

import {sleep} from './util';

export class FakeOutlineConnection implements cordova.plugins.outline.Connection {
  private running = false;
  private broken: boolean;
  private reachable: boolean;

  constructor(public config: cordova.plugins.outline.ServerConfig, public id: string) {
    const serverName = this.config.name || this.config.host || '';
    this.broken = serverName.toLowerCase().includes('broken');
    this.reachable = !serverName.toLowerCase().includes('unreachable');
  }

  start(): Promise<void> {
    if (this.running) return Promise.resolve();
    return sleep(250).then(() => {
      if (this.broken) {
        throw new Error(`FakeServer ${this.id} fake failed to connect (broken is true)`);
      } else {
        this.running = true;
      }
    });
  }

  stop(): Promise<void> {
    if (!this.running) return Promise.resolve();
    return sleep(250).then(() => {
      this.running = false;
    });
  }

  isRunning(): Promise<boolean> {
    return Promise.resolve(this.running);
  }

  isReachable(): Promise<boolean> {
    return Promise.resolve(this.reachable);
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): void {
    // NOOP
  }
}
