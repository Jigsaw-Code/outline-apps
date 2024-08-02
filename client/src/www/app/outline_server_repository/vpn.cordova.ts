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

import { TunnelStatus } from './vpn';
import { SessionConfig } from './vpn';
import { VpnApi } from './vpn';
import * as errors from '../../model/errors';
import {OUTLINE_PLUGIN_NAME, pluginExecWithErrorCode} from '../plugin.cordova';

export class CordovaVpnApi implements VpnApi {
  start(id: string, name: string, config: SessionConfig) {
    if (!config) {
      throw new errors.IllegalServerConfiguration();
    }
    return pluginExecWithErrorCode<void>('start', id, name, config);
  }

  stop(id: string) {
    return pluginExecWithErrorCode<void>('stop', id);
  }

  isRunning(id: string) {
    return pluginExecWithErrorCode<boolean>('isRunning', id);
  }

  onStatusChange(listener: (id: string, status: TunnelStatus) => void): void {
    const onError = (err: unknown) => {
      console.warn('failed to execute status change listener', err);
    };
    // Can't use `pluginExec` because Cordova needs to call the listener multiple times.
    const callback = (data: any) => {
      listener(data.id, data.status)
    }
    cordova.exec(callback, onError, OUTLINE_PLUGIN_NAME, 'onStatusChange');
  }
}