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

// Please also update preload.d.ts whenever you changed this file.

import * as os from 'node:os';

import {clipboard, contextBridge, ipcRenderer, IpcRendererEvent} from 'electron';
import '@sentry/electron/preload';

/**
 * The method channel for sending messages through electron's IPC.
 *
 * All functions are defined as fields because `contextBridge` will only inject
 * fields (defined in object) but not functions (defined in prototype) to the
 * global object.
 */
export class ElectronRendererMethodChannel {
  /**
   * Construct a electron's renderer method channel with a specific namespace.
   * @param namespace The namespace string which will be the prefix of all channels.
   *
   * We need to have a namespace due to security consideration:
   *   - https://www.electronjs.org/docs/latest/tutorial/context-isolation#security-considerations
   */
  public constructor(private readonly namespace: string) {}

  public readonly send = (channel: string, ...args: unknown[]): void =>
    ipcRenderer.send(`${this.namespace}-${channel}`, ...args);

  // TODO: replace the `any` with a better type once we unify the IPC call framework
  /* eslint-disable  @typescript-eslint/no-explicit-any */
  public readonly invoke = (channel: string, ...args: unknown[]): Promise<any> =>
    ipcRenderer.invoke(`${this.namespace}-${channel}`, ...args);

  public readonly on = (channel: string, listener: (e: IpcRendererEvent, ...args: unknown[]) => void): void => {
    ipcRenderer.on(`${this.namespace}-${channel}`, listener);
  };

  public readonly once = (channel: string, listener: (e: IpcRendererEvent, ...args: unknown[]) => void): void => {
    ipcRenderer.once(`${this.namespace}-${channel}`, listener);
  };
}

contextBridge.exposeInMainWorld('electron', {
  // TODO: move this os definition to a platform api call in the future
  os: {
    platform: os.platform(),
  },
  // TODO: move this clipboard definition to a platform api call as well
  clipboard: clipboard,
  // TODO: refactor channel namespace to a constant
  methodChannel: new ElectronRendererMethodChannel('outline-ipc'),
});
