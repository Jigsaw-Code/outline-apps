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

// TODO: add guidelines for this file

export enum ServerType {
  // The connection data is static, doesn't change, and isn't deleted on disconnect.
  STATIC_CONNECTION,

  // The connection data is refetched via the access key on each connection.
  // and deleted on each disconnection
  DYNAMIC_CONNECTION,
}

// TODO(daniellacosse): determine what properties should be controlled only by the Server implementation and make them readonly
export interface Server {
  // A unique id that identifies this Server.
  readonly id: string;

  // A type specifying the manner in which the Server connects.
  readonly type: ServerType;

  // The name of this server, as given by the user.
  name: string;

  // The location to pull the session config from on each connection.
  sessionConfigLocation?: URL;

  // The address of the service.
  address: string;

  // Whether this is an Outline server (access key ends in 'outline=1').
  // Used to provide a default name to the server card.
  isOutlineServer: boolean;

  // The message identifier corresponding to the server error state. This identifier
  // must match one of the localized app message.
  errorMessageId?: string;

  // Connects to the server, redirecting the device's traffic.
  connect(): Promise<void>;

  // Disconnects from the server and stops any traffic redirection.
  disconnect(): Promise<void>;

  // Checks whether the server is already active and in use.
  checkRunning(): Promise<boolean>;
}

export interface ServerRepository {
  add(accessKey: string): void;
  forget(serverId: string): void;
  undoForget(serverId: string): void;
  getAll(): Server[];
  getById(serverId: string): Server | undefined;
}
