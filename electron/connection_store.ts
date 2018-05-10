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

  // Persists the connection to the store.
  save(connection: SerializableConnection) {
    fs.writeFile(this.storagePath, JSON.stringify(connection), 'utf8', (error) => {
      if (error) {
        console.error('Failed to store connection.');
      }
    });
  }

  // Retrieves a connection from storage. Rejects the promise if there is none.
  load(): Promise<SerializableConnection> {
    return new Promise((resolve, reject) => {
      fs.readFile(this.storagePath, 'utf8', (error, data) => {
        if (!data) {
          console.warn('No connection in store.');
          reject(error);
          return;
        }
        resolve(JSON.parse(data));
      });
    });
  }

  // Deletes the stored connection.
  clear() {
    if (!this.hasConnection()) {
      return;
    }
    fs.unlink(this.storagePath, (error) => {
      if (!!error) {
        console.error('Failed to clear connection store.');
      }
    });
  }

  // Returns whether there is a connection in store.
  hasConnection() {
    return fs.existsSync(this.storagePath);
  }
}
