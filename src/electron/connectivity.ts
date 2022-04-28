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

import * as dns from 'dns';
import * as net from 'net';

import * as util from '../www/app/util';
import * as errors from '../www/model/errors';

const DNS_LOOKUP_TIMEOUT_MS = 10000;

// Uses the OS' built-in functions, i.e. /etc/hosts, et al.:
// https://nodejs.org/dist/latest-v10.x/docs/api/dns.html#dns_dns
//
// Effectively a no-op if hostname is already an IP.
export function lookupIp(hostname: string): Promise<string> {
  return util.timeoutPromise(
    new Promise<string>((fulfill, reject) => {
      dns.lookup(hostname, 4, (e, address) => {
        if (e) {
          return reject(new errors.ServerUnreachable('could not resolve proxy server hostname'));
        }
        fulfill(address);
      });
    }),
    DNS_LOOKUP_TIMEOUT_MS,
    'DNS lookup'
  );
}

// Resolves iff a (TCP) connection can be established with the specified destination within the
// specified timeout (zero means "no timeout"), optionally retrying with a delay.
export function isServerReachable(
  host: string,
  port: number,
  timeout = 0,
  maxAttempts = 1,
  retryIntervalMs = 0
): Promise<void> {
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
