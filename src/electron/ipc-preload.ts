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

import {ipcRenderer, IpcRendererEvent} from 'electron';
import {
  OutlineIpcOneWayChannels,
  OutlineIpcTwoWayChannels,
  OUTLINE_ONE_WAY_IPC_CHANNELS,
  OUTLINE_TWO_WAY_IPC_CHANNELS,
} from './ipc';
import {ErrorCode} from '../www/model/errors';

/**
 * The IPC sender implementation which can be exposed in preload script and
 * used by renderer together with `OutlineIpcClient` and `OutlineIpcHandler`
 * class.
 *
 * We cannot put everything in one single file (for example, `ipc.ts`) because
 * we are not allowed to `import * from "electron"` in renderer, and any
 * exceptions thrown in preload script will be sanitized so renderer will catch
 * nothing, both are due to `contextIsolation`.
 *
 * We also need to limit the channel types due to security consideration:
 *   - https://www.electronjs.org/docs/latest/tutorial/context-isolation#security-considerations
 *
 * All function should be defined as `readonly` fields because preload will
 * only inject fields but not functions to the global object.
 */
export class OutlineIpcPreloadImpl {
  public readonly send = (channel: string, ...args: unknown[]): void => {
    if (!OUTLINE_ONE_WAY_IPC_CHANNELS.includes(<OutlineIpcOneWayChannels>channel)) {
      console.warn(`ipc channel ${channel} is not allowed to send`);
      return;
    }
    ipcRenderer.send(channel, ...args);
  };

  public readonly invoke = async (channel: string, ...args: unknown[]): Promise<[ErrorCode, unknown]> => {
    if (!OUTLINE_TWO_WAY_IPC_CHANNELS.includes(<OutlineIpcTwoWayChannels>channel)) {
      console.warn(`ipc channel ${channel} is not allowed to invoke`);
      return [ErrorCode.UNEXPECTED, undefined];
    }
    const result = await ipcRenderer.invoke(channel, ...args);
    if (!Array.isArray(result) || result.length === 0) {
      console.error(`ipc invoke via ${channel} received non-tuple result`);
      return [ErrorCode.UNEXPECTED, undefined];
    }
    if (typeof result[0] !== 'number') {
      console.error(`ipc invoke via ${channel} received a tuple without ErrorCode`);
      return [ErrorCode.UNEXPECTED, undefined];
    }
    return result as [ErrorCode, unknown];
  };

  public readonly once = (channel: string, listener: (e: IpcRendererEvent, ...args: unknown[]) => void): void => {
    if (!OUTLINE_ONE_WAY_IPC_CHANNELS.includes(<OutlineIpcOneWayChannels>channel)) {
      console.warn(`ipc channel ${channel} is not allowed to subscribe once`);
      return;
    }
    ipcRenderer.once(channel, listener);
  };

  public readonly on = (channel: string, listener: (e: IpcRendererEvent, ...args: unknown[]) => void): void => {
    if (!OUTLINE_ONE_WAY_IPC_CHANNELS.includes(<OutlineIpcOneWayChannels>channel)) {
      console.warn(`ipc channel ${channel} is not allowed to subscribe`);
      return;
    }
    ipcRenderer.on(channel, listener);
  };

  public readonly removeListener = (
    channel: string,
    listener: (e: IpcRendererEvent, ...args: unknown[]) => void
  ): void => {
    if (!OUTLINE_ONE_WAY_IPC_CHANNELS.includes(<OutlineIpcOneWayChannels>channel)) {
      console.warn(`ipc channel ${channel} is not allowed to unsubscribe`);
      return;
    }
    ipcRenderer.removeListener(channel, listener);
  };
}
