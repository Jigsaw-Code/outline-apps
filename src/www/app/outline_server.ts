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

import * as uuidv4 from 'uuidv4';

import * as errors from '../model/errors';
import * as events from '../model/events';
import {Server, ServerRepository} from '../model/server';

import {accessKeyToShadowsocksConfig, ShadowsocksConfig, shadowsocksConfigToAccessKey} from './config';
import {Tunnel, TunnelStatus} from './tunnel';

export class OutlineServer implements Server {
  // We restrict to AEAD ciphers because unsafe ciphers are not supported in go-tun2socks.
  // https://shadowsocks.org/en/spec/AEAD-Ciphers.html
  private static readonly SUPPORTED_CIPHERS =
      ['chacha20-ietf-poly1305', 'aes-128-gcm', 'aes-192-gcm', 'aes-256-gcm'];

  private config: ShadowsocksConfig;

  constructor(
      public readonly id: string, public readonly accessKey: string, public name: string,
      private tunnel: Tunnel, private eventQueue: events.EventQueue) {
    this.config = accessKeyToShadowsocksConfig(accessKey);
    this.tunnel.onStatusChange((status: TunnelStatus) => {
      let statusEvent: events.OutlineEvent;
      switch (status) {
        case TunnelStatus.CONNECTED:
          statusEvent = new events.ServerConnected(this);
          break;
        case TunnelStatus.DISCONNECTED:
          statusEvent = new events.ServerDisconnected(this);
          break;
        case TunnelStatus.RECONNECTING:
          statusEvent = new events.ServerReconnecting(this);
          break;
        default:
          console.warn(`Received unknown tunnel status ${status}`);
          return;
      }
      eventQueue.enqueue(statusEvent);
    });
  }

  get host() {
    return `${this.config.host}:${this.config.port}`;
  }

  async connect() {
    try {
      this.config.name = this.name;
      await this.tunnel.start(this.config);
    } catch (e) {
      // e originates in "native" code: either Cordova or Electron's main process.
      // Because of this, we cannot assume "instanceof OutlinePluginError" will work.
      if (e.errorCode) {
        throw errors.fromErrorCode(e.errorCode);
      }
      throw e;
    }
  }

  async disconnect() {
    try {
      await this.tunnel.stop();
      delete this.config;
    } catch (e) {
      // All the plugins treat disconnection errors as ErrorCode.UNEXPECTED.
      throw new errors.RegularNativeError();
    }
  }

  checkRunning(): Promise<boolean> {
    return this.tunnel.isRunning();
  }

  checkReachable(): Promise<boolean> {
    return this.tunnel.isReachable(this.config);
  }

  static isServerCipherSupported(cipher?: string) {
    return cipher !== undefined && OutlineServer.SUPPORTED_CIPHERS.includes(cipher);
  }
}

// Persistence format for an Outline Server.
interface OutlineServerJson {
  // Shadowsocks access key encoding proxy configuration parameters.
  readonly accessKey: string;
  // User-given name.
  readonly name: string;
}

export interface ConfigByIdV0 {
  [serverId: string]: ShadowsocksConfig;
}

export interface ConfigById {
  [serverId: string]: OutlineServerJson;
}

export type OutlineServerFactory =
    (id: string, accessKey: string, name: string, eventQueue: events.EventQueue) => OutlineServer;

// Maintains a persisted set of servers and liaises with the core.
export class OutlineServerRepository implements ServerRepository {
  // Name by which servers are saved to storage.
  public static readonly SERVERS_STORAGE_KEY_V0 = 'servers';
  public static readonly SERVERS_STORAGE_KEY = 'servers_v1';
  private serverById!: Map<string, OutlineServer>;
  private lastForgottenServer: OutlineServer|null = null;

  constructor(
      public readonly createServer: OutlineServerFactory, private eventQueue: events.EventQueue,
      private storage: Storage) {
    try {
      migrateServerStorageToV1(this.storage);
    } catch (e) {
      console.error(`failed to migrate storage to V1: ${e}`);
      return;
    }
    this.loadServers();
  }

  getAll() {
    return Array.from(this.serverById.values());
  }

  getById(serverId: string) {
    return this.serverById.get(serverId);
  }

  add(accessKey: string, serverName: string) {
    const alreadyAddedServer = this.serverFromAccessKey(accessKey);
    if (alreadyAddedServer) {
      throw new errors.ServerAlreadyAdded(alreadyAddedServer);
    }
    const server = this.createServer(uuidv4(), accessKey, serverName, this.eventQueue);
    this.serverById.set(server.id, server);
    this.storeServers();
    this.eventQueue.enqueue(new events.ServerAdded(server));
  }

  rename(serverId: string, newName: string) {
    const server = this.serverById.get(serverId);
    if (!server) {
      console.warn(`Cannot rename nonexistent server ${serverId}`);
      return;
    }
    server.name = newName;
    this.storeServers();
    this.eventQueue.enqueue(new events.ServerRenamed(server));
  }

  forget(serverId: string) {
    const server = this.serverById.get(serverId);
    if (!server) {
      console.warn(`Cannot remove nonexistent server ${serverId}`);
      return;
    }
    this.serverById.delete(serverId);
    this.lastForgottenServer = server;
    this.storeServers();
    this.eventQueue.enqueue(new events.ServerForgotten(server));
  }

  undoForget(serverId: string) {
    if (!this.lastForgottenServer) {
      console.warn('No forgotten server to unforget');
      return;
    } else if (this.lastForgottenServer.id !== serverId) {
      console.warn('id of forgotten server', this.lastForgottenServer, 'does not match', serverId);
      return;
    }
    this.serverById.set(this.lastForgottenServer.id, this.lastForgottenServer);
    this.storeServers();
    this.eventQueue.enqueue(new events.ServerForgetUndone(this.lastForgottenServer));
    this.lastForgottenServer = null;
  }

  containsServer(accessKey: string): boolean {
    return !!this.serverFromAccessKey(accessKey);
  }

  private serverFromAccessKey(accessKey: string): OutlineServer|undefined {
    for (const server of this.serverById.values()) {
      if (accessKeysMatch(accessKey, server.accessKey)) {
        return server;
      }
    }
    return undefined;
  }

  private storeServers() {
    const configById: ConfigById = {};
    for (const [serverId, server] of this.serverById) {
      configById[serverId] = {accessKey: server.accessKey, name: server.name};
    }
    const json = JSON.stringify(configById);
    this.storage.setItem(OutlineServerRepository.SERVERS_STORAGE_KEY, json);
  }

  // Loads servers from storage, raising an error if there is any problem loading.
  private loadServers() {
    this.serverById = new Map<string, OutlineServer>();
    const serversJson = this.storage.getItem(OutlineServerRepository.SERVERS_STORAGE_KEY);
    if (!serversJson) {
      console.debug(`no servers found in storage`);
      return;
    }
    let configById: ConfigById = {};
    try {
      configById = JSON.parse(serversJson);
    } catch (e) {
      throw new Error(`could not parse saved servers: ${e.message}`);
    }
    for (const serverId in configById) {
      if (configById.hasOwnProperty(serverId)) {
        const serverJson = configById[serverId];
        try {
          const server =
              this.createServer(serverId, serverJson.accessKey, serverJson.name, this.eventQueue);
          this.serverById.set(serverId, server);
        } catch (e) {
          // Don't propagate so other stored servers can be created.
          console.error(e);
        }
      }
    }
  }
}

function accessKeysMatch(a: string, b: string): boolean {
  const removeFragment = (accessKey: string) => {
    const fragmentIndex = accessKey.indexOf('#');
    if (fragmentIndex === -1) {
      return accessKey;
    }
    return accessKey.substring(0, fragmentIndex);
  };
  return removeFragment(a) === removeFragment(b);
}


// Performs a data schema migration from `ConfigByIdV0` to `ConfigById` on `storage`.
export function migrateServerStorageToV1(storage: Storage) {
  if (storage.getItem(OutlineServerRepository.SERVERS_STORAGE_KEY)) {
    console.debug('server storage already migrated to V1');
    return;
  }
  const serversJsonV0 = storage.getItem(OutlineServerRepository.SERVERS_STORAGE_KEY_V0);
  if (!serversJsonV0) {
    console.debug('no V0 servers found in storage');
    return;
  }

  let configByIdV0: ConfigByIdV0 = {};
  configByIdV0 = JSON.parse(serversJsonV0);
  const configByIdV1: ConfigById = {};
  for (const serverId in configByIdV0) {
    if (!configByIdV0.hasOwnProperty(serverId)) {
      continue;
    }
    const config: ShadowsocksConfig = configByIdV0[serverId];
    const name = config.name;
    const accessKey = shadowsocksConfigToAccessKey(config);
    configByIdV1[serverId] = {accessKey, name};
  }

  const serversJsonV1 = JSON.stringify(configByIdV1);
  storage.setItem(OutlineServerRepository.SERVERS_STORAGE_KEY, serversJsonV1);
}
