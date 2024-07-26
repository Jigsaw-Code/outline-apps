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

import * as outline_server_repository from '.';
import {OUTLINE_PLUGIN_NAME, pluginExecWithErrorCode} from '../plugin.cordova';
import {ShadowsocksSessionConfig, Tunnel, TunnelStatus} from '../tunnel';
import * as errors from '../../model/errors';

// This function must be called to use the Cordova implementation.
export function useCordovaTunnel() {
  outline_server_repository.setTunnelFactory(
    (tunnelId: string): Tunnel => {
      return new CordovaTunnel(tunnelId);
    }
  )
}

class CordovaTunnel implements Tunnel {
  constructor(public id: string) {}

  start(config: ShadowsocksSessionConfig) {
    if (!config) {
      throw new errors.IllegalServerConfiguration();
    }
    return pluginExecWithErrorCode<void>('start', this.id, config);
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
    cordova.exec(listener, onError, OUTLINE_PLUGIN_NAME, 'onStatusChange', [this.id]);
  }
}
