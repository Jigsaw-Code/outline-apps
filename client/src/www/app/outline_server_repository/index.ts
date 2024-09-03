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

import {Localizer} from '@outline/infrastructure/i18n';
import {makeConfig, SIP002_URI} from 'ShadowsocksConfig';
import uuidv4 from 'uuidv4';

import {validateStaticKey} from './access_key';
import {OutlineServer} from './server';
import {TunnelStatus, VpnApi} from './vpn';
import * as errors from '../../model/errors';
import * as events from '../../model/events';
import {ServerRepository, ServerType} from '../../model/server';

// TODO(daniellacosse): write unit tests for these functions

// Compares access keys proxying parameters.
function staticKeysMatch(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

// Determines if the key is expected to be a url pointing to an ephemeral session config.
function isDynamicAccessKey(accessKey: string): boolean {
  return accessKey.startsWith('ssconf://') || accessKey.startsWith('https://');
}

// NOTE: For extracting a name that the user has explicitly set, only.
// (Currenly done by setting the hash on the URI)
function serverNameFromAccessKey(accessKey: string): string | undefined {
  const {hash} = new URL(accessKey.replace(/^ss(?:conf)?:\/\//, 'https://'));

  if (!hash) return;

  return decodeURIComponent(
    hash
      .slice(1)
      .split('&')
      .find(keyValuePair => !keyValuePair.includes('='))
  );
}

// DEPRECATED: V0 server persistence format.

interface ServersStorageV0Config {
  host?: string;
  port?: number;
  password?: string;
  method?: string;
  name?: string;
}
export interface ServersStorageV0 {
  [serverId: string]: ServersStorageV0Config;
}

// Enccodes a V0 storage configuration into an access key string.
export function serversStorageV0ConfigToAccessKey(
  config: ServersStorageV0Config
): string {
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
  static readonly SERVERS_STORAGE_KEY_V0 = 'servers';
  static readonly SERVERS_STORAGE_KEY = 'servers_v1';
  private serverById!: Map<string, OutlineServer>;
  private lastForgottenServer: OutlineServer | null = null;

  constructor(
    private vpnApi: VpnApi,
    private eventQueue: events.EventQueue,
    private storage: Storage,
    private localize: Localizer
  ) {
    console.debug('OutlineServerRepository is initializing');
    this.loadServers();
    console.debug('OutlineServerRepository loaded servers');
    vpnApi.onStatusChange((id: string, status: TunnelStatus) => {
      console.debug(
        `OutlineServerRepository received status update for server ${id}: ${status}`
      );
      let statusEvent: events.OutlineEvent;
      switch (status) {
        case TunnelStatus.CONNECTED:
          statusEvent = new events.ServerConnected(id);
          break;
        case TunnelStatus.DISCONNECTING:
          statusEvent = new events.ServerDisconnecting(id);
          break;
        case TunnelStatus.DISCONNECTED:
          statusEvent = new events.ServerDisconnected(id);
          break;
        case TunnelStatus.RECONNECTING:
          statusEvent = new events.ServerReconnecting(id);
          break;
        default:
          console.warn(
            `Received unknown tunnel status ${status} for tunnel ${id}`
          );
          return;
      }
      eventQueue.enqueue(statusEvent);
    });
    console.debug('OutlineServerRepository registered server status callback');
  }

  getAll() {
    return Array.from(this.serverById.values());
  }

  getById(serverId: string) {
    return this.serverById.get(serverId);
  }

  add(accessKey: string) {
    this.validateAccessKey(accessKey);

    // Note that serverNameFromAccessKey depends on the fact that the Access Key is a URL.
    const serverName = serverNameFromAccessKey(accessKey);
    const server = this.createServer(uuidv4(), accessKey, serverName);

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
      console.warn(
        'id of forgotten server',
        this.lastForgottenServer,
        'does not match',
        serverId
      );
      return;
    }
    this.serverById.set(this.lastForgottenServer.id, this.lastForgottenServer);
    this.storeServers();
    this.eventQueue.enqueue(
      new events.ServerForgetUndone(this.lastForgottenServer)
    );
    this.lastForgottenServer = null;
  }

  validateAccessKey(accessKey: string) {
    if (!isDynamicAccessKey(accessKey)) {
      return this.validateStaticKey(accessKey);
    }

    try {
      // URL does not parse the hostname if the protocol is non-standard (e.g. non-http)
      new URL(accessKey.replace(/^ssconf:\/\//, 'https://'));
    } catch (error) {
      throw new errors.ServerUrlInvalid(error.message);
    }
  }

  private validateStaticKey(staticKey: string) {
    const alreadyAddedServer = this.serverFromAccessKey(staticKey);
    if (alreadyAddedServer) {
      throw new errors.ServerAlreadyAdded(alreadyAddedServer);
    }
    validateStaticKey(staticKey);
  }

  private serverFromAccessKey(accessKey: string): OutlineServer | undefined {
    for (const server of this.serverById.values()) {
      if (
        server.type === ServerType.DYNAMIC_CONNECTION &&
        accessKey === server.accessKey
      ) {
        return server;
      }

      if (staticKeysMatch(accessKey, server.accessKey)) {
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
    const serversJson = this.storage.getItem(
      OutlineServerRepository.SERVERS_STORAGE_KEY_V0
    );
    if (!serversJson) {
      console.debug('no V0 servers found in storage');
      return;
    }
    let configById: ServersStorageV0 = {};
    try {
      configById = JSON.parse(serversJson);
    } catch (e) {
      throw new Error(`could not parse saved V0 servers: ${e.message}`);
    }
    for (const serverId of Object.keys(configById)) {
      const v0Config = configById[serverId];

      try {
        this.loadServer({
          id: serverId,
          accessKey: serversStorageV0ConfigToAccessKey(v0Config),
          name: v0Config.name,
        });
      } catch (e) {
        // Don't propagate so other stored servers can be created.
        console.error(e);
      }
    }
  }

  private loadServersV1() {
    this.serverById = new Map<string, OutlineServer>();
    const serversStorageJson = this.storage.getItem(
      OutlineServerRepository.SERVERS_STORAGE_KEY
    );
    if (!serversStorageJson) {
      console.debug('no servers found in storage');
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
    const server = this.createServer(
      serverJson.id,
      serverJson.accessKey,
      serverJson.name
    );
    this.serverById.set(serverJson.id, server);
  }

  private createServer(
    id: string,
    accessKey: string,
    name?: string
  ): OutlineServer {
    const server = new OutlineServer(
      this.vpnApi,
      id,
      name,
      accessKey,
      isDynamicAccessKey(accessKey)
        ? ServerType.DYNAMIC_CONNECTION
        : ServerType.STATIC_CONNECTION,
      this.localize
    );

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
