// Copyright 2021 The Outline Authors
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

import {makeConfig, SHADOWSOCKS_URI, SIP002_URI} from 'ShadowsocksConfig';
import * as uuidv4 from 'uuidv4';

import * as errors from '../model/errors';
import * as events from '../model/events';
import {Server, ServerRepository} from '../model/server';

import {ShadowsocksConfig} from './config';
import {Tunnel, TunnelStatus} from './tunnel';

export class OutlineServer implements Server {
  // We restrict to AEAD ciphers because unsafe ciphers are not supported in go-tun2socks.
  // https://shadowsocks.org/en/spec/AEAD-Ciphers.html
  private static readonly SUPPORTED_CIPHERS =
      ['chacha20-ietf-poly1305', 'aes-128-gcm', 'aes-192-gcm', 'aes-256-gcm'];

  errorMessageId?: string;

  constructor(
      public readonly id: string, public name: string, private readonly config: ShadowsocksConfig,
      private tunnel: Tunnel, private eventQueue: events.EventQueue) {
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

  get accessKey() {
    return shadowsocksConfigToAccessKey(this.config);
  }

  get address() {
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
    (id: string, name: string, config: ShadowsocksConfig, eventQueue: events.EventQueue) =>
        OutlineServer;

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
    const config = accessKeyToShadowsocksConfig(accessKey);
    const server = this.createServer(uuidv4(), serverName, config, this.eventQueue);
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

  validateAccessKey(accessKey: string, outlineServerName?: string, defaultServerName?: string):
      string|undefined {
    const alreadyAddedServer = this.serverFromAccessKey(accessKey);
    if (alreadyAddedServer) {
      throw new errors.ServerAlreadyAdded(alreadyAddedServer);
    }
    let config = null;
    try {
      config = SHADOWSOCKS_URI.parse(accessKey);
    } catch (error) {
      throw new errors.ServerUrlInvalid(error.message || 'failed to parse access key');
    }
    if (config.host.isIPv6) {
      throw new errors.ServerIncompatible('unsupported IPv6 host address');
    }
    if (!OutlineServer.isServerCipherSupported(config.method.data)) {
      throw new errors.ShadowsocksUnsupportedCipher(config.method.data || 'unknown');
    }
    return config.extra?.outline && outlineServerName ? outlineServerName :
                                                        config.tag?.data || defaultServerName;
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
          const config = accessKeyToShadowsocksConfig(serverJson.accessKey);
          const server = this.createServer(serverId, serverJson.name, config, this.eventQueue);
          if (!OutlineServer.isServerCipherSupported(config.method)) {
            server.errorMessageId = 'unsupported-cipher';
          }
          this.serverById.set(serverId, server);
        } catch (e) {
          // Don't propagate so other stored servers can be created.
          console.error(e);
        }
      }
    }
  }
}

// Parses an access key string into a ShadowsocksConfig object.
export function accessKeyToShadowsocksConfig(accessKey: string): ShadowsocksConfig {
  try {
    const config = SHADOWSOCKS_URI.parse(accessKey);
    return {
      host: config.host.data,
      port: config.port.data,
      method: config.method.data,
      password: config.password.data,
    };
  } catch (error) {
    throw new errors.ServerUrlInvalid(error.message || 'failed to parse access key');
  }
}

// Enccodes a Shadowsocks proxy configuration into an access key string.
export function shadowsocksConfigToAccessKey(config: ShadowsocksConfig): string {
  // Exclude the name and only encode proxying parameters.
  return SIP002_URI.stringify(makeConfig({
    host: config.host,
    port: config.port,
    method: config.method,
    password: config.password,
  }));
}

// Compares access keys proxying parameters.
function accessKeysMatch(a: string, b: string): boolean {
  try {
    const l = accessKeyToShadowsocksConfig(a);
    const r = accessKeyToShadowsocksConfig(b);
    return l.host === r.host && l.port === r.port && l.password === r.password &&
        l.method === r.method;
  } catch (e) {
    console.error(`failed to parse access key for comparison`);
  }
  return false;
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
