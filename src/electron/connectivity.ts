// Copyright 2019 The Outline Authors
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

import * as net from 'net';
import * as errors from '../www/model/errors';

import {ChildProcessHelper} from './child_process';
import {pathToEmbeddedBinary} from './util';

// Resolves iff a (TCP) connection can be established with the specified destination within the
// specified timeout (zero means "no timeout"), optionally retrying with a delay.
export function isServerReachable(
    host: string, port: number, timeout = 0, maxAttempts = 1, retryIntervalMs = 0) {
  let attempt = 0;
  return new Promise((fulfill, reject) => {
    const connect = () => {
      attempt++;

      const socket = new net.Socket();
      socket.once('error', () => {
        if (attempt < maxAttempts) {
          setTimeout(connect, retryIntervalMs);
        } else {
          reject(new errors.ServerUnreachable());
        }
      });

      if (timeout > 0) {
        socket.setTimeout(timeout);
      }

      socket.connect({host, port}, () => {
        socket.end();
        fulfill();
      });
    };
    connect();
  });
}

// Class to test Shadowsocks connectivity through tun2socks.
export class ShadowsocksConnectivity {
  private tun2socks: ChildProcessHelper;

  constructor(config: cordova.plugins.outline.ServerConfig) {
    this.tun2socks = new ChildProcessHelper(pathToEmbeddedBinary('go-tun2socks', 'tun2socks'));
    const args: string[] = [];
    args.push('-proxyHost', config.host || '');
    args.push('-proxyPort', `${config.port}`);
    args.push('-proxyPassword', config.password || '');
    args.push('-proxyCipher', config.method || '');
    args.push('-checkConnectivity');
    this.tun2socks.launch(args);
  }

  // Returns a Promise that resolves if the connectivity checks succeed, indicating whehter
  // UDP is supported. Rejects if the connectivity checks fail.
  public get onceResult(): Promise<boolean> {
    // NOTE: must return a Promise because getters cannot be async.
    return new Promise(async (resolve, reject) => {
      const code = await this.tun2socks.onExit;
      if (code === errors.ErrorCode.NO_ERROR) {
        return resolve(true);
      } else if (code === errors.ErrorCode.UDP_RELAY_NOT_ENABLED) {
        return resolve(false);
      }
      // Treat the absence of a code as an unexpected error.
      reject(errors.fromErrorCode(code || errors.ErrorCode.UNEXPECTED));
    });
  }
}
