// Copyright 2020 The Outline Authors
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

import * as fs from 'fs';
import * as path from 'path';

// Format to store a tunnel configuration.
export interface SerializableTunnel {
  id: string;
  config: cordova.plugins.outline.ServerConfig;
  isUdpSupported?: boolean;
}

// Persistence layer for a single SerializableTunnel.
export class TunnelStore {
  private storagePath: string;

  // Creates the store at `storagePath`.
  constructor(storagePath: string) {
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath);
    }
    // TODO(alalama): rename key to 'tunnel_store' when performing a data migration.
    this.storagePath = path.join(storagePath, 'connection_store');
  }

  // Persists the tunnel to the store. Rejects the promise on failure.
  save(tunnel: SerializableTunnel): Promise<void> {
    if (!this.isTunnelValid(tunnel)) {
      return Promise.reject(new Error('Cannot save invalid tunnel'));
    }
    return new Promise((resolve, reject) => {
      fs.writeFile(this.storagePath, JSON.stringify(tunnel), 'utf8', (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  // Retrieves a tunnel from storage. Rejects the promise if there is none.
  load(): Promise<SerializableTunnel> {
    return new Promise((resolve, reject) => {
      fs.readFile(this.storagePath, 'utf8', (error, data) => {
        if (!data) {
          reject(error);
          return;
        }
        const tunnel = JSON.parse(data);
        if (this.isTunnelValid(tunnel)) {
          resolve(tunnel);
        } else {
          reject(new Error('Cannot load invalid tunnel'));
        }
      });
    });
  }

  // Deletes the stored tunnel. Rejects the promise on failure.
  clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.storagePath)) {
        resolve();
      }
      fs.unlink(this.storagePath, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  // Returns whether `tunnel` and its configuration contain all the required fields.
  private isTunnelValid(tunnel: SerializableTunnel) {
    const config = tunnel.config;
    if (!config || !tunnel.id) {
      return false;
    }
    return config.method && config.password && config.host && config.port && config.name;
  }
}
