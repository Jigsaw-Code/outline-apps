// Copyright 2024 The Outline Authors
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

import {ShadowsocksSessionConfig, PlatformTunnel, TunnelStatus} from './server';
import * as errors from '../../model/errors';
import {OUTLINE_PLUGIN_NAME, pluginExecWithErrorCode} from '../plugin.cordova';

export class CordovaTunnel implements PlatformTunnel {
  constructor(public id: string) {}

  start(name: string, config: ShadowsocksSessionConfig) {
    if (!config) {
      throw new errors.IllegalServerConfiguration();
    }
    return pluginExecWithErrorCode<void>('start', this.id, name, config);
  }

  stop() {
    return pluginExecWithErrorCode<void>('stop', this.id);
  }

  isRunning() {
    return pluginExecWithErrorCode<boolean>('isRunning', this.id);
  }

  onStatusChange(listener: (status: TunnelStatus) => void): void {
    const onError = (err: unknown) => {
      console.warn('failed to execute status change listener', err);
    };
    // Can't use `pluginExec` because Cordova needs to call the listener multiple times.
    cordova.exec(listener, onError, OUTLINE_PLUGIN_NAME, 'onStatusChange', [
      this.id,
    ]);
  }
}
