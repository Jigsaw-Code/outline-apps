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

/// <reference path="../types/ambient/outlinePlugin.d.ts" />

import * as fs from 'fs';
import * as path from 'path';

// Format to store a connection.
export interface SerializableConnection {
  id: string;
  config: cordova.plugins.outline.ServerConfig;
}

// Persistence layer for a single SerializableConnection.
export class ConnectionStore {
  private storagePath: string;

  // Creates the store at `storagePath`.
  constructor(storagePath: string) {
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath);
    }
    this.storagePath = path.join(storagePath, 'connection_store');
  }

  // Persists the connection to the store. Rejects the promise on failure.
  save(connection: SerializableConnection): Promise<void> {
    if (!this.isConnectionValid(connection)) {
      return Promise.reject(new Error('Cannot save invalid connection'));
    }
    return new Promise((resolve, reject) => {
      fs.writeFile(this.storagePath, JSON.stringify(connection), 'utf8', (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  // Retrieves a connection from storage. Rejects the promise if there is none.
  load(): Promise<SerializableConnection> {
    return new Promise((resolve, reject) => {
      fs.readFile(this.storagePath, 'utf8', (error, data) => {
        if (!data) {
          reject(error);
          return;
        }
        const connection = JSON.parse(data);
        if (this.isConnectionValid(connection)) {
          resolve(connection);
        } else {
          reject(new Error('Cannot load invalid connection'));
        }
      });
    });
  }

  // Deletes the stored connection. Rejects the promise on failure.
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

  // Returns whether `connection` and its configuration contain all the required fields.
  private isConnectionValid(connection: SerializableConnection) {
    const config = connection.config;
    if (!config || !connection.id) {
      return false;
    }
    return config.method && config.password && config.host && config.port && config.name;
  }
}
