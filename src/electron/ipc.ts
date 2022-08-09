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

import {IpcMainEvent, IpcMainInvokeEvent, IpcRendererEvent} from 'electron';
import {ShadowsocksConfig} from '../www/app/config';
import {ErrorCode, NativeError, OutlinePluginError, toErrorCode} from '../www/model/errors';

// This file is used to define all IPC messages. To add a new IPC message:
//   1. Add a `XXX_CHANNEL` constant below
//   2. Copy the `XXX_CHANNEL` to either `OUTLINE_ONE_WAY_IPC_CHANNELS` or
//      `OUTLINE_TWO_WAY_IPC_CHANNELS`
//   3. Define the parameters and return type in either `OutlineIpcOneWayService`
//      or `OutlineIpcTwoWayService`
//   4. That's it, implement the handler, it should already be strongly typed.

export const QUIT_APP_CHANNEL = 'quit-app';
export const APP_UPDATE_DOWNLOADED_CHANNEL = 'update-downloaded';
export const PUSH_CLIPBOARD_CHANNEL = 'push-clipboard';
export const INSTALL_SERVICES_CHANNEL = 'install-outline-services';
export const ADD_SERVER_CHANNEL = 'add-server';
export const CHECK_REACHABLE_CHANNEL = 'is-server-reachable';
export const START_VPN_CHANNEL = 'start-proxying';
export const STOP_VPN_CHANNEL = 'stop-proxying';
export const VPN_CONNECTED_CHANNEL = 'proxy-connected';
export const VPN_RECONNECTING_CHANNEL = 'proxy-reconnecting';
export const VPN_DISCONNECTED_CHANNEL = 'proxy-disconnected';
export const REQUEST_LOCALIZATION_CHANNEL = 'localization-request';
export const LOCALIZATION_RESPONSE_CHANNEL = 'localization-response';

/**
 * This array defines all one-way IPC channels used by `.send` and `.on`.
 */
export const OUTLINE_ONE_WAY_IPC_CHANNELS = <const>[
  QUIT_APP_CHANNEL,
  APP_UPDATE_DOWNLOADED_CHANNEL,
  PUSH_CLIPBOARD_CHANNEL,
  ADD_SERVER_CHANNEL,
  VPN_CONNECTED_CHANNEL,
  VPN_RECONNECTING_CHANNEL,
  VPN_DISCONNECTED_CHANNEL,
  REQUEST_LOCALIZATION_CHANNEL,
  LOCALIZATION_RESPONSE_CHANNEL,
];

/**
 * This array defines all two-way IPC channels used by `.invoke` and `.handle`.
 */
export const OUTLINE_TWO_WAY_IPC_CHANNELS = <const>[
  INSTALL_SERVICES_CHANNEL,
  CHECK_REACHABLE_CHANNEL,
  START_VPN_CHANNEL,
  STOP_VPN_CHANNEL,
];

/**
 * Define the contract (request and response type) of all one-way IPC channels.
 * This interface should only be used for type definitions, please **do not**
 * try to implement it.
 *
 * Please make sure the return type is always `void`.
 */
export interface OutlineIpcOneWayService {
  [QUIT_APP_CHANNEL]: () => void;
  [APP_UPDATE_DOWNLOADED_CHANNEL]: () => void;
  [PUSH_CLIPBOARD_CHANNEL]: () => void;
  [ADD_SERVER_CHANNEL]: (url: string) => void;
  [VPN_CONNECTED_CHANNEL]: (id: string) => void;
  [VPN_RECONNECTING_CHANNEL]: (id: string) => void;
  [VPN_DISCONNECTED_CHANNEL]: (id: string) => void;
  [REQUEST_LOCALIZATION_CHANNEL]: (localizationKeys: string[]) => void;
  [LOCALIZATION_RESPONSE_CHANNEL]: (result?: {[key: string]: string}) => void;
}

/**
 * Define the contract (request and response type) of all two-way IPC channels.
 * This interface should only be used for type definitions, please **do not**
 * try to implement it.
 *
 * Please do not include `Promise` or `ErrorCode` in the return type, they will
 * be automatically handled by `OutlineIpcClient` and `OutlineIpcHandler`.
 *
 * We use `ErrorCode` (a.k.a, a `number`) to pass exceptions because catching
 * custom errors (even as simple as numbers) does not work in electron:
 *   - https://github.com/electron/electron/issues/24427
 */
export interface OutlineIpcTwoWayService {
  [INSTALL_SERVICES_CHANNEL]: () => void;
  [CHECK_REACHABLE_CHANNEL]: (hostname: string, port: number) => boolean;
  [START_VPN_CHANNEL]: (config: ShadowsocksConfig, id: string) => void;
  [STOP_VPN_CHANNEL]: () => void;
}

/**
 * This is a type definition of all one-way IPC channels which can be used as
 * the type of an IPC message string (`'quit-app' | 'add-server' | ...`).
 */
export type OutlineIpcOneWayChannels = typeof OUTLINE_ONE_WAY_IPC_CHANNELS[number] & keyof OutlineIpcOneWayService;

/**
 * This is a type definition of all two-way IPC channels which can be used as
 * the type of an IPC message string (`'start-proxying' | ...`).
 */
export type OutlineIpcTwoWayChannels = typeof OUTLINE_TWO_WAY_IPC_CHANNELS[number] & keyof OutlineIpcTwoWayService;

/**
 * The IPC response type across boundaries. This type should be shared between
 * `.handle` and `.invoke` methods.
 *
 * We use `ErrorCode` (a.k.a, a `number`) to pass exceptions because catching
 * custom errors (even as simple as numbers) does not work in electron:
 *   - https://github.com/electron/electron/issues/24427
 */
export type IpcInvokeResultCrossBoundary<T extends OutlineIpcTwoWayChannels> = Promise<
  [ErrorCode, ReturnType<OutlineIpcTwoWayService[T]>]
>;

/**
 * The IPC sender class which can be used by both main process and renderer
 * process. The caller is responsible to give it the correct implementation
 * of the underlying IPC strategy (for example, `mainWindow.webContents`,
 * or an object exposed by preload script).
 *
 * @example
 *   // In main process
 *   const client = new OutlineIpcClient(mainWindow.webContents);
 *   client.send(APP_UPDATE_DOWNLOADED_CHANNEL);
 *
 *   // In renderer process (window.ipcImpl is injected by preload)
 *   const client = new OutlineIpcClient(window.ipcImpl);
 *   const result = await client.invoke(STOP_VPN_CHANNEL);
 */
export class OutlineIpcClient {
  /**
   * Create a new instance of IPC client on top of `ipcImpl`.
   * @param ipcImpl The underlying implementation to send IPC messages.
   */
  public constructor(
    private readonly ipcImpl: {
      send(channel: string, ...args: unknown[]): void;
      invoke?<T extends OutlineIpcTwoWayChannels>(channel: string, ...args: unknown[]): IpcInvokeResultCrossBoundary<T>;
    }
  ) {}

  /**
   * Send a message to the other process via `channel` and return.
   * @param channel One of the predefined `OUTLINE_ONE_WAY_IPC_CHANNELS`.
   * @param args Parameters which can be inferred by the `channel`.
   */
  public send<T extends OutlineIpcOneWayChannels>(
    channel: T,
    ...args: Parameters<OutlineIpcOneWayService[T]>
  ): ReturnType<OutlineIpcOneWayService[T]> & void {
    this.ipcImpl.send(channel, ...args);
  }

  /**
   * Send a message to main process via `channel` and wait for the result. We
   * will also convert the returned `ErrorCode` into an `OutlinePluginError`
   * and throw if it is not `NO_ERROR`.
   * @param channel One of the predefined `OUTLINE_TWO_WAY_IPC_CHANNELS`.
   * @param args Parameters which can be inferred by the `channel`.
   * @returns A promise of the result object returned from the main process.
   */
  public async invoke<T extends OutlineIpcTwoWayChannels>(
    channel: T,
    ...args: Parameters<OutlineIpcTwoWayService[T]>
  ): Promise<ReturnType<OutlineIpcTwoWayService[T]>> {
    const [err, result] = await this.ipcImpl.invoke(channel, ...args);
    if (err !== ErrorCode.NO_ERROR) {
      throw new OutlinePluginError(err);
    }
    return result as ReturnType<OutlineIpcTwoWayService[T]>;
  }
}

/**
 * The IPC handler class which can be used by both main process and renderer
 * process. The caller is responsible to give it the correct implementation
 * of the underlying IPC strategy (for example, `ipcMain`, or an object exposed
 * by preload script).
 *
 * @example
 *   // In main process
 *   const handler = new OutlineIpcHandler(ipcMain);
 *   handler.on(QUIT_APP_CHANNEL, () => { ... });
 *   handler.handle(STOP_VPN_CHANNEL, async () => { ... });
 *
 *   // In renderer process (window.ipcImpl is injected by preload)
 *   const handler = new OutlineIpcHandler(window.ipcImpl);
 *   handler.on(APP_UPDATE_DOWNLOADED_CHANNEL, () => { ... });
 */
export class OutlineIpcHandler {
  /**
   * Create a new instance of IPC handler on top of `ipcImpl`.
   * @param ipcImpl The underlying implementation to subscribe to IPC messages.
   */
  public constructor(
    private readonly ipcImpl: {
      once(channel: string, listener: (e: IpcMainEvent | IpcRendererEvent, ...args: unknown[]) => void): void;
      on(channel: string, listener: (e: IpcMainEvent | IpcRendererEvent, ...args: unknown[]) => void): void;
      removeListener(channel: string, listener: (...args: unknown[]) => void): void;
      handle?(channel: string, listener: (e: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void;
      removeHandler?(channel: string): void;
    }
  ) {}

  /**
   * Subscribe to a message from the other process via `channel`.
   * @param channel One of the predefined `OUTLINE_ONE_WAY_IPC_CHANNELS`.
   * @param handler A handler function whose parameters can be inferred by the
   *                `channel` and the return value is disregarded.
   */
  public on<T extends OutlineIpcOneWayChannels>(
    channel: T,
    handler: (...args: Parameters<OutlineIpcOneWayService[T]>) => ReturnType<OutlineIpcOneWayService[T]>
  ): void {
    this.ipcImpl.on(channel, (_, ...args: Parameters<typeof handler>) => handler(...args));
  }

  /**
   * Subscribe to a message from the renderer process via `channel`.
   * @param channel One of the predefined `OUTLINE_TWO_WAY_IPC_CHANNELS`.
   * @param handler A handler function whose parameters can be inferred by the
   *                `channel` and the return value will be sent back to renderer.
   *                You can throw any errors derived from `NativeError`.
   */
  public handle<T extends OutlineIpcTwoWayChannels>(
    channel: T,
    handler: (
      ...args: Parameters<OutlineIpcTwoWayService[T]>
    ) => ReturnType<OutlineIpcTwoWayService[T]> | Promise<ReturnType<OutlineIpcTwoWayService[T]>>
  ): void {
    return this.ipcImpl.handle(
      channel,
      async (_, ...args: Parameters<OutlineIpcTwoWayService[T]>): IpcInvokeResultCrossBoundary<T> => {
        try {
          const result = handler(...args);
          if (typeof result === 'object' && typeof result.then === 'function') {
            return [ErrorCode.NO_ERROR, await result];
          }
          return [ErrorCode.NO_ERROR, result as ReturnType<OutlineIpcTwoWayService[T]>];
        } catch (e) {
          if (typeof e === 'number') {
            return [e, undefined];
          } else if (e instanceof NativeError) {
            return [toErrorCode(e), undefined];
          } else {
            return [ErrorCode.UNEXPECTED, undefined];
          }
        }
      }
    );
  }

  /**
   * Subscribe to a message only once from the other process via `channel`.
   * @param channel One of the predefined `OUTLINE_ONE_WAY_IPC_CHANNELS`.
   * @param handler A handler function whose parameters can be inferred by the
   *                `channel` and the return value is disregarded.
   */
  public once<T extends OutlineIpcOneWayChannels>(
    channel: T,
    handler: (...args: Parameters<OutlineIpcOneWayService[T]>) => ReturnType<OutlineIpcOneWayService[T]>
  ): void {
    this.ipcImpl.once(channel, (_, ...args: Parameters<typeof handler>) => handler(...args));
  }

  /**
   * Unsubscribe a message from the other process via `channel`.
   * @param channel One of the predefined `OUTLINE_ONE_WAY_IPC_CHANNELS`.
   * @param handler A handler function that has been passed to `on`.
   */
  public removeListener<T extends OutlineIpcOneWayChannels>(
    channel: T,
    handler: (...args: Parameters<OutlineIpcOneWayService[T]>) => ReturnType<OutlineIpcOneWayService[T]>
  ): void {
    this.ipcImpl.removeListener(channel, (_, ...args: Parameters<typeof handler>) => handler(...args));
  }

  /**
   * Unsubscribe all handler messages from the other process via `channel`.
   * @param channel One of the predefined `OUTLINE_TWO_WAY_IPC_CHANNELS`.
   */
  public removeHandler<T extends OutlineIpcTwoWayChannels>(channel: T): void {
    this.ipcImpl.removeHandler(channel);
  }
}
