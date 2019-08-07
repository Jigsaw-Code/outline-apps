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

import {ServerAlreadyAdded} from '../model/errors';
import * as events from '../model/events';
import {Server, ServerRepository} from '../model/server';

type ServerConfig = cordova.plugins.outline.ServerConfig;

export interface PersistentServer extends Server { config: ServerConfig; }

interface ConfigById {
  [serverId: string]: ServerConfig;
}

export type PersistentServerFactory =
    (id: string, config: ServerConfig, eventQueue: events.EventQueue) => PersistentServer;

// Maintains a persisted set of servers and liaises with the core.
export class PersistentServerRepository implements ServerRepository {
  // Name by which servers are saved to storage.
  private static readonly SERVERS_STORAGE_KEY = 'servers';
  private serverById!: Map<string, PersistentServer>;
  private lastForgottenServer: PersistentServer|null = null;

  constructor(
      public readonly createServer: PersistentServerFactory, private eventQueue: events.EventQueue,
      private storage: Storage) {
    this.loadServers();
  }

  getAll() {
    return Array.from(this.serverById.values());
  }

  getById(serverId: string) {
    return this.serverById.get(serverId);
  }

  add(serverConfig: ServerConfig) {
    const alreadyAddedServer = this.serverFromConfig(serverConfig);
    if (alreadyAddedServer) {
      throw new ServerAlreadyAdded(alreadyAddedServer);
    }
    const server = this.createServer(uuidv4(), serverConfig, this.eventQueue);
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

  containsServer(config: ServerConfig): boolean {
    return !!this.serverFromConfig(config);
  }

  private serverFromConfig(config: ServerConfig): PersistentServer|undefined {
    for (const server of this.getAll()) {
      if (configsMatch(server.config, config)) {
        return server;
      }
    }
  }

  private storeServers() {
    const configById: ConfigById = {};
    for (const server of this.serverById.values()) {
      configById[server.id] = server.config;
    }
    const json = JSON.stringify(configById);
    this.storage.setItem(PersistentServerRepository.SERVERS_STORAGE_KEY, json);
  }

  // Loads servers from storage,
  // raising an error if there is any problem loading.
  private loadServers() {
    this.serverById = new Map<string, PersistentServer>();
    const serversJson = this.storage.getItem(PersistentServerRepository.SERVERS_STORAGE_KEY);
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
        const config = configById[serverId];
        try {
          const server = this.createServer(serverId, config, this.eventQueue);
          this.serverById.set(serverId, server);
        } catch (e) {
          // Don't propagate so other stored servers can be created.
          console.error(e);
        }
      }
    }
  }
}

function configsMatch(left: ServerConfig, right: ServerConfig) {
  return left.host === right.host && left.port === right.port && left.method === right.method &&
      left.password === right.password;
}
