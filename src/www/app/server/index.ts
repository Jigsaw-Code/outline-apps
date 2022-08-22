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

import uuidv4 from 'uuidv4';

import {ServerRepository} from '../../model/server';
import * as errors from '../../model/errors';
import * as events from '../../model/events';

import {NativeNetworking} from '../net';
import {ShadowsocksConfig} from '../config';
import {TunnelFactory} from '../tunnel';

import {OutlineServer} from './server';
import {OutlineServiceConfig} from './service_config';
import {accessKeyToServiceConfig} from './service_config/utils';

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
    const config = accessKeyToServiceConfig(accessKey);
    const server = this.createServer(uuidv4(), config);
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
  }

  private serverFromAccessKey(accessKey: string): OutlineServer | undefined {
    for (const server of this.serverById.values()) {
      if (server.serviceConfig.isEqualTo(accessKeyToServiceConfig(accessKey))) {
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
        accessKey: server.serviceConfig.toString(),
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
        this.loadServer({
          id: serverId,
          accessKey: new OutlineServiceConfig(config.name, config).toString(),
          name: config.name,
        });
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

  private loadServer({id, accessKey, name}: OutlineServerJson) {
    const config = accessKeyToServiceConfig(accessKey);
    const server = this.createServer(id, config);

    server.name = name;

    this.serverById.set(id, server);
  }

  private createServer(id: string, config: OutlineServiceConfig): OutlineServer {
    const alreadyAddedServer = this.serverFromAccessKey(config.toString());

    if (alreadyAddedServer) {
      throw new errors.ServerAlreadyAdded(alreadyAddedServer);
    }

    return new OutlineServer(id, config, config.connection.name, this.createTunnel(id), this.net, this.eventQueue);
  }
}
