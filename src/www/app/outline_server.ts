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

import {makeConfig, SHADOWSOCKS_URI, SIP002_URI} from 'ShadowsocksConfig';
import uuidv4 from 'uuidv4';

import * as errors from '../model/errors';
import * as events from '../model/events';
import {Server, ServerRepository} from '../model/server';

import {ShadowsocksConfig} from './config';
import {NativeNetworking} from './net';
import {RoutingPolicy, Tunnel, TunnelFactory, TunnelStatus} from './tunnel';

export class OutlineServer implements Server {
  // We restrict to AEAD ciphers because unsafe ciphers are not supported in go-tun2socks.
  // https://shadowsocks.org/en/spec/AEAD-Ciphers.html
  private static readonly SUPPORTED_CIPHERS = ['chacha20-ietf-poly1305', 'aes-128-gcm', 'aes-192-gcm', 'aes-256-gcm'];

  errorMessageId?: string;
  policy?: RoutingPolicy;
  private config: ShadowsocksConfig;

  constructor(
    public readonly id: string,
    public readonly accessKey: string,
    private _name: string,
    private tunnel: Tunnel,
    private net: NativeNetworking,
    private eventQueue: events.EventQueue
  ) {
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

  get name() {
    return this._name;
  }

  set name(newName: string) {
    this._name = newName;
    this.config.name = newName;
  }

  get address() {
    return `${this.config.host}:${this.config.port}`;
  }

  get isOutlineServer() {
    return this.accessKey.includes('outline=1');
  }

  async connect() {
    try {
      await this.tunnel.start(this.config, this.policy);
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
    return this.net.isServerReachable(this.config.host, this.config.port);
  }

  static isServerCipherSupported(cipher?: string) {
    return cipher !== undefined && OutlineServer.SUPPORTED_CIPHERS.includes(cipher);
  }
}

// DEPRECATED: V0 server persistence format.
export interface ServersStorageV0 {
  [serverId: string]: ShadowsocksConfig;
}

// V1 server persistence format.
export type ServersStorageV1 = OutlineServerJson[];

interface OutlineServerJson {
  readonly id: string;
  readonly accessKey: string;
  readonly name: string;
}

// Maintains a persisted set of servers and liaises with the core.
export class OutlineServerRepository implements ServerRepository {
  // Name by which servers are saved to storage.
  public static readonly SERVERS_STORAGE_KEY_V0 = 'servers';
  public static readonly SERVERS_STORAGE_KEY = 'servers_v1';
  private serverById!: Map<string, OutlineServer>;
  private lastForgottenServer: OutlineServer | null = null;

  constructor(
    private readonly net: NativeNetworking,
    private readonly createTunnel: TunnelFactory,
    private eventQueue: events.EventQueue,
    private storage: Storage
  ) {
    this.loadServers();
  }

  getAll() {
    return Array.from(this.serverById.values());
  }

  getById(serverId: string) {
    return this.serverById.get(serverId);
  }

  add(accessKey: string) {
    const config = accessKeyToShadowsocksConfig(accessKey);
    const server = this.createServer(uuidv4(), accessKey, config.name);
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

  validateAccessKey(accessKey: string) {
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
  }

  private serverFromAccessKey(accessKey: string): OutlineServer | undefined {
    for (const server of this.serverById.values()) {
      if (accessKeysMatch(accessKey, server.accessKey)) {
        return server;
      }
    }
    return undefined;
  }

  private storeServers() {
    const servers: ServersStorageV1 = [];
    for (const server of this.serverById.values()) {
      servers.push({
        id: server.id,
        accessKey: server.accessKey,
        name: server.name,
      });
    }
    const json = JSON.stringify(servers);
    this.storage.setItem(OutlineServerRepository.SERVERS_STORAGE_KEY, json);
  }

  // Loads servers from storage, raising an error if there is any problem loading.
  private loadServers() {
    if (this.storage.getItem(OutlineServerRepository.SERVERS_STORAGE_KEY)) {
      console.debug('server storage migrated to V1');
      this.loadServersV1();
      return;
    }
    this.loadServersV0();
  }

  private loadServersV0() {
    this.serverById = new Map<string, OutlineServer>();
    const serversJson = this.storage.getItem(OutlineServerRepository.SERVERS_STORAGE_KEY_V0);
    if (!serversJson) {
      console.debug(`no V0 servers found in storage`);
      return;
    }
    let configById: ServersStorageV0 = {};
    try {
      configById = JSON.parse(serversJson);
    } catch (e) {
      throw new Error(`could not parse saved V0 servers: ${e.message}`);
    }
    for (const serverId of Object.keys(configById)) {
      const config = configById[serverId];
      try {
        this.loadServer({id: serverId, accessKey: shadowsocksConfigToAccessKey(config), name: config.name});
      } catch (e) {
        // Don't propagate so other stored servers can be created.
        console.error(e);
      }
    }
  }

  private loadServersV1() {
    this.serverById = new Map<string, OutlineServer>();
    const serversStorageJson = this.storage.getItem(OutlineServerRepository.SERVERS_STORAGE_KEY);
    if (!serversStorageJson) {
      console.debug(`no servers found in storage`);
      return;
    }
    let serversJson: ServersStorageV1 = [];
    try {
      serversJson = JSON.parse(serversStorageJson);
    } catch (e) {
      throw new Error(`could not parse saved servers: ${e.message}`);
    }
    for (const serverJson of serversJson) {
      try {
        this.loadServer(serverJson);
      } catch (e) {
        // Don't propagate so other stored servers can be created.
        console.error(e);
      }
    }
  }

  private loadServer(serverJson: OutlineServerJson) {
    const server = this.createServer(serverJson.id, serverJson.accessKey, serverJson.name);
    this.serverById.set(serverJson.id, server);
  }

  private createServer(id: string, accessKey: string, name: string): OutlineServer {
    const server = new OutlineServer(id, accessKey, name, this.createTunnel(id), this.net, this.eventQueue);
    // Demo: Exclude Google.
    server.policy = {
      excludedSubnets: [
        '8.8.4.0/24',
        '8.8.8.0/24',
        '8.34.208.0/20',
        '8.35.192.0/20',
        '23.236.48.0/20',
        '23.251.128.0/19',
        '34.0.0.0/15',
        '34.2.0.0/16',
        '34.3.0.0/23',
        '34.3.3.0/24',
        '34.3.4.0/24',
        '34.3.8.0/21',
        '34.3.16.0/20',
        '34.3.32.0/19',
        '34.3.64.0/18',
        '34.3.128.0/17',
        '34.4.0.0/14',
        '34.8.0.0/13',
        '34.16.0.0/12',
        '34.32.0.0/11',
        '34.64.0.0/10',
        '34.128.0.0/10',
        '35.184.0.0/13',
        '35.192.0.0/14',
        '35.196.0.0/15',
        '35.198.0.0/16',
        '35.199.0.0/17',
        '35.199.128.0/18',
        '35.200.0.0/13',
        '35.208.0.0/12',
        '35.224.0.0/12',
        '35.240.0.0/13',
        '64.15.112.0/20',
        '64.233.160.0/19',
        '66.102.0.0/20',
        '66.249.64.0/19',
        '70.32.128.0/19',
        '72.14.192.0/18',
        '74.114.24.0/21',
        '74.125.0.0/16',
        '104.154.0.0/15',
        '104.196.0.0/14',
        '104.237.160.0/19',
        '107.167.160.0/19',
        '107.178.192.0/18',
        '108.59.80.0/20',
        '108.170.192.0/18',
        '108.177.0.0/17',
        '130.211.0.0/16',
        '136.112.0.0/12',
        '142.250.0.0/15',
        '146.148.0.0/17',
        '162.216.148.0/22',
        '162.222.176.0/21',
        '172.110.32.0/21',
        '172.217.0.0/16',
        '172.253.0.0/16',
        '173.194.0.0/16',
        '173.255.112.0/20',
        '192.158.28.0/22',
        '192.178.0.0/15',
        '193.186.4.0/24',
        '199.36.154.0/23',
        '199.36.156.0/24',
        '199.192.112.0/22',
        '199.223.232.0/21',
        '207.223.160.0/20',
        '208.65.152.0/22',
        '208.68.108.0/22',
        '208.81.188.0/22',
        '208.117.224.0/19',
        '209.85.128.0/17',
        '216.58.192.0/19',
        '216.73.80.0/20',
        '216.239.32.0/19',
      ],
      excludedDomains: '.*google.*',
    };
    try {
      this.validateAccessKey(accessKey);
    } catch (e) {
      if (e instanceof errors.ShadowsocksUnsupportedCipher) {
        // Don't throw for backward-compatibility.
        server.errorMessageId = 'unsupported-cipher';
      } else {
        throw e;
      }
    }
    return server;
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
      name: config.tag.data,
    };
  } catch (error) {
    throw new errors.ServerUrlInvalid(error.message || 'failed to parse access key');
  }
}

// Enccodes a Shadowsocks proxy configuration into an access key string.
export function shadowsocksConfigToAccessKey(config: ShadowsocksConfig): string {
  return SIP002_URI.stringify(
    makeConfig({
      host: config.host,
      port: config.port,
      method: config.method,
      password: config.password,
      tag: config.name,
    })
  );
}

// Compares access keys proxying parameters.
function accessKeysMatch(a: string, b: string): boolean {
  try {
    const l = accessKeyToShadowsocksConfig(a);
    const r = accessKeyToShadowsocksConfig(b);
    return l.host === r.host && l.port === r.port && l.password === r.password && l.method === r.method;
  } catch (e) {
    console.debug(`failed to parse access key for comparison`);
  }
  return false;
}
