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

import {ChildProcess, exec, execFile, execFileSync} from 'child_process';
import * as http from 'http';
import * as httpproxytosocks from 'http-proxy-to-socks/lib/proxy_server';
import * as net from 'net';
import * as path from 'path';
import * as process from 'process';
import * as socks from 'socks';
import * as url from 'url';

// TODO: These should probably be pulled up a level now that Electron code also uses them.
import * as util from '../www/app/util';
import * as errors from '../www/model/errors';

import {SentryLogger} from './sentry_logger';

const sentryLogger = new SentryLogger();

// The returned path must be kept in sync with:
//  - the destination path for the binaries in build_action.sh
//  - the value specified for --config.asarUnpack in package_action.sh
function pathToEmbeddedExe(basename: string) {
  return path.join(
      __dirname.replace('app.asar', 'app.asar.unpacked'), 'bin', 'win32', `${basename}.exe`);
}

// Three tools are required to launch the proxy on Windows:
//  - ss-local.exe connects with the remote Shadowsocks server, exposing a SOCKS5 proxy.
//  - http-proxy-to-socks fronts the SOCKS5 proxy with a HTTP proxy (Windows cannot connect to a
//  SOCKS5 server directly).
//  - setsystemproxy.exe configures the system to use the HTTP proxy.

let ssLocal: ChildProcess|undefined;
let httpProxy: http.Server|undefined;

const PROXY_IP = '127.0.0.1';
const SS_LOCAL_PORT = 1081;

const CREDENTIALS_TEST_DOMAINS = ['example.com', 'ietf.org', 'wikipedia.org'];
const REACHABILITY_TEST_TIMEOUT_MS = 10000;

// Fulfills with true iff both proxy binaries were started, the system configured to use the HTTP
// proxy, and we can both connect to the Shadowsocks server port *and* connect to a semi-random test
// site through the Shadowsocks proxy.
//
// Rejects with an ErrorCode number if for any reason the proxy cannot be started, or a connection
// cannot be made to the server (it does *not* reject with an Error, just an integer, owing to how
// electron-promise-ipc propagates errors).
//
// The latter two tests are roughly what happens in cordova-plugin-outline, making this function the
// Electron counterpart to VpnTunnelService.startShadowsocks. The biggest difference is that we do
// not test the Shadowsocks server's support for UDP because on Windows the Shadowsocks proxy is
// fronted by a HTTP proxy, which does not support UDP.
export function launchProxy(
    config: cordova.plugins.outline.ServerConfig, onDisconnected: () => void) {
  return isServerReachable(config)
      .catch((e) => {
        throw errors.ErrorCode.SERVER_UNREACHABLE;
      })
      .then(() => {
        return startLocalShadowsocksProxy(config, onDisconnected)
            .catch((e) => {
              throw errors.ErrorCode.SHADOWSOCKS_START_FAILURE;
            })
            .then(() => {
              return validateServerCredentials()
                  .catch((e) => {
                    throw errors.ErrorCode.INVALID_SERVER_CREDENTIALS;
                  })
                  .then(() => {
                    return startHttpProxy()
                        .catch((e) => {
                          throw errors.ErrorCode.HTTP_PROXY_START_FAILURE;
                        })
                        .then((port) => {
                          try {
                            configureSystemProxy(port);
                          } catch (e) {
                            throw errors.ErrorCode.CONFIGURE_SYSTEM_PROXY_FAILURE;
                          }
                        });
                  });
            });
      });
}

// Resolves with true iff a TCP connection can be established with the Shadowsocks server.
//
// This has the same function as ShadowsocksConnectivity.isServerReachable in cordova-plugin-outline.
export function isServerReachable(config: cordova.plugins.outline.ServerConfig) {
  return util.timeoutPromise(
      new Promise<void>((fulfill, reject) => {
        const socket = new net.Socket();
        socket
            .connect(
                {host: config.host || '', port: config.port || 0},
                () => {
                  socket.end();
                  fulfill();
                })
            .on('error', () => {
              reject(new Error(`could not create socket, or connect to host`));
            });
      }),
      REACHABILITY_TEST_TIMEOUT_MS);
}

function startLocalShadowsocksProxy(
    serverConfig: cordova.plugins.outline.ServerConfig, onDisconnected: () => void) {
  return new Promise((resolve, reject) => {
    // ss-local -s x.x.x.x -p 65336 -k mypassword -m aes-128-cfb -l 1081
    const ssLocalArgs: string[] = ['-l', SS_LOCAL_PORT.toString()];
    ssLocalArgs.push('-s', serverConfig.host || '');
    ssLocalArgs.push('-p', '' + serverConfig.port);
    ssLocalArgs.push('-k', serverConfig.password || '');
    ssLocalArgs.push('-m', serverConfig.method || '');

    try {
      ssLocal = execFile(pathToEmbeddedExe('ss-local'), ssLocalArgs);

      ssLocal.on('exit', (code, signal) => {
        // We assume any signal sent to ss-local was sent by us.
        if (signal) {
          sentryLogger.info(`ss-local exited with signal ${signal}`);
          onDisconnected();
          return;
        }

        sentryLogger.info(`ss-local exited with code ${code}`);
        onDisconnected();
      });

      // There's NO WAY to tell programmatically when ss-local.exe has successfully
      // launched; only when it fails.
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

// Resolves with true iff a response can be received from a semi-randomly-chosen website through the
// Shadowsocks proxy.
//
// This has the same function as ShadowsocksConnectivity.validateServerCredentials in
// cordova-plugin-outline.
function validateServerCredentials() {
  return new Promise((fulfill, reject) => {
    const testDomain =
        CREDENTIALS_TEST_DOMAINS[Math.floor(Math.random() * CREDENTIALS_TEST_DOMAINS.length)];
    socks.createConnection(
        {
          proxy: {ipaddress: PROXY_IP, port: SS_LOCAL_PORT, type: 5},
          target: {host: testDomain, port: 80}
        },
        (e, socket) => {
          if (e) {
            reject(new Error(`could not connect to remote test website: ${e.message}`));
            return;
          }

          socket.write(`HEAD / HTTP/1.1\r\nHost: ${testDomain}\r\n\r\n`);

          socket.on('data', (data) => {
            if (data.toString().startsWith('HTTP/1.1')) {
              socket.end();
              fulfill();
            } else {
              socket.end();
              reject(new Error(`unexpected response from remote test website`));
            }
          });

          socket.on('close', () => {
            reject(new Error(`could not connect to remote test website`));
          });

          // Sockets must be resumed before any data will come in, as they are paused right before
          // this callback is fired.
          socket.resume();
        });
  });
}

function startHttpProxy(): Promise<number> {
  return new Promise((fulfill, reject) => {
    const newHttpProxy = httpproxytosocks.createServer({socks: `${PROXY_IP}:${SS_LOCAL_PORT}`});
    newHttpProxy.listen(0, PROXY_IP)
        .on('listening',
            () => {
              httpProxy = newHttpProxy;
              fulfill(newHttpProxy.address().port);
            })
        .on('error', (e: Error) => {
          reject(new Error(`could not start HTTP proxy: ${e.message}`));
        });
  });
}

function stopSsLocal() {
  if (!ssLocal) {
    return Promise.resolve();
  }
  ssLocal.kill();
  return Promise.resolve();
}

function stopHttpProxy() {
  return new Promise((resolve) => {
    if (httpProxy) {
      // Because http-proxy-to-socks doesn't give us any control over
      // connection timeouts, it can take a long time for the server to
      // fully shutdown - freezing the UI. So, resolve immediately
      // and log when it finally happens.
      httpProxy.close((e: Error) => {
        if (e) {
          sentryLogger.error(`could not stop HTTP proxy: ${e}`);
          return;
        }
        sentryLogger.info('HTTP proxy stopped');
      });
    }
    resolve();
  });
}

// Configures the system to use our proxy.
// TODO: Make some effort to backup and restore the system proxy settings.
function configureSystemProxy(httpProxyPort: number) {
  try {
    execFileSync(
        pathToEmbeddedExe('setsystemproxy'), ['on', `${PROXY_IP}:${httpProxyPort}`],
        {timeout: 1500});
  } catch (e) {
    throw new Error(`could not configure system proxy: ${e.stderr}`);
  }
}

// Configures the system to no longer use our proxy.
function resetSystemProxy() {
  sentryLogger.info(`resetting system proxy`);
  try {
    execFileSync(pathToEmbeddedExe('setsystemproxy'), ['off']);
  } catch (e) {
    throw new Error(`could not reset system proxy: ${e.stderr}`);
  }
}

export function teardownProxy() {
  try {
    resetSystemProxy();
    return Promise.all([stopSsLocal(), stopHttpProxy()]);
  } catch (e) {
    return Promise.reject(e);
  }
}
