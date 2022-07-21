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

// Starting from electron 12, contextIsolation is turned on by default.
// So we are not able to use node APIs or electron APIs in renderer scripts
// any more. We have to inject key features into the global window object
// in preload: https://www.electronjs.org/docs/latest/tutorial/tutorial-preload.

import {contextBridge, ipcRenderer} from 'electron';
import * as os from 'os';
import {ErrorCode} from '../www/model/errors';

contextBridge.exposeInMainWorld('os', {
  platform: os.platform(),
});

contextBridge.exposeInMainWorld('ipc', {
  sendQuitApp: (): void => {
    ipcRenderer.send('quit-app');
  },

  sendEnvironmentInfo: (env: {appVersion: string; dsn: string}): void => {
    ipcRenderer.send('environment-info', env);
  },

  sendInstallOutlineServices: (): Promise<ErrorCode> => {
    return ipcRenderer.invoke('install-outline-services');
  },

  onAddServer: (callback: (url: string) => void): void => {
    ipcRenderer.on('add-server', (_, url) => callback(url));
  },

  onLocalizationRequest: (callback: (localizationKeys: string[]) => void): void => {
    ipcRenderer.on('localizationRequest', (_, keys) => callback(keys));
  },

  sendLocalizationResponse: (result?: {[key: string]: string}): void => {
    ipcRenderer.send('localizationResponse', result);
  },

  onPushClipboard: (callback: () => void): void => {
    ipcRenderer.on('push-clipboard', callback);
  },

  onUpdateDownloaded: (callback: () => void): void => {
    ipcRenderer.on('update-downloaded', callback);
  },
});
