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

import {ChildProcess, exec, execFile, execFileSync, spawn} from 'child_process';
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
//  - ss-local.exe connects with the remote Shadowsocks server, exposing a SOCKS5 proxy
//  - badvpn-tun2socks.exe connects the SOCKS5 proxy to a TAP-like network interface
//  - setsystemroute.exe configures the system to route via a TAP-like network device

let ssLocal: ChildProcess|undefined;
let tun2socks: ChildProcess|undefined;

const PROXY_IP = '127.0.0.1';
const SS_LOCAL_PORT = 1081;

const TUN2SOCKS_TAP_DEVICE_NAME = 'outline-tap0';
const TUN2SOCKS_PROCESS_WAIT_TIME_MS = 5000;

// TODO: read these from the network device!
const TUN2SOCKS_TAP_DEVICE_IP = '10.0.85.2';
const TUN2SOCKS_VIRTUAL_ROUTER_IP = '10.0.85.1';
const TUN2SOCKS_TAP_DEVICE_NETWORK = '10.0.85.0';
const TUN2SOCKS_VIRTUAL_ROUTER_NETMASK = '255.255.255.0';

let previousGateway: string;
let currentProxyServer: string;

const CREDENTIALS_TEST_DOMAINS = ['example.com', 'ietf.org', 'wikipedia.org'];
const REACHABILITY_TEST_TIMEOUT_MS = 10000;

// Fulfills with true iff shadowsocks and tun2socks binaries were started, the system configured to
// route all traffic through the proxy, and we can both connect to the Shadowsocks server port *and*
// connect to a semi-random test site through the Shadowsocks proxy.
//
// Rejects with an ErrorCode number if for any reason the proxy cannot be started, or a connection
// cannot be made to the server (it does *not* reject with an Error, just an integer, owing to how
// electron-promise-ipc propagates errors).
//
// The latter two tests are roughly what happens in cordova-plugin-outline, making this function the
// Electron counterpart to VpnTunnelService.startShadowsocks.
//
// TODO: implement UDP forwarding check.
export function startVpn(
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
                    return startTun2socks(config.host || '', onDisconnected)
                        .catch((e) => {
                          throw errors.ErrorCode.VPN_START_FAILURE;
                        })
                        .then((port) => {
                          // there is a slight delay before tun2socks
                          // correctly configures the virtual router. before then,
                          // configuring the route table will not work as expected.
                          // TODO: hack tun2socks to write something to stdout when it's ready
                          sentryLogger.info('waiting 5s for tun2socks to come up...');
                          return configureRoutingWithDelay(
                              config.host || '', TUN2SOCKS_PROCESS_WAIT_TIME_MS).catch((e) => {
                                throw errors.ErrorCode.CONFIGURE_SYSTEM_PROXY_FAILURE;
                              });
                        });
                  });
            });
      });
}

// Resolves with true iff a TCP connection can be established with the Shadowsocks server.
//
// This has the same function as ShadowsocksConnectivity.isServerReachable in
// cordova-plugin-outline.
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
    // ss-local -s x.x.x.x -p 65336 -k mypassword -m aes-128-cfb -l 1081 -u
    const ssLocalArgs: string[] = ['-l', SS_LOCAL_PORT.toString()];
    ssLocalArgs.push('-s', serverConfig.host || '');
    ssLocalArgs.push('-p', '' + serverConfig.port);
    ssLocalArgs.push('-k', serverConfig.password || '');
    ssLocalArgs.push('-m', serverConfig.method || '');
    ssLocalArgs.push('-u');

    try {
      ssLocal = spawn(pathToEmbeddedExe('ss-local'), ssLocalArgs, {stdio: 'ignore'});

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

function startTun2socks(host: string, onDisconnected: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    // ./badvpn-tun2socks.exe \
    //   --tundev "tap0901:outline-tap0:10.0.85.2:10.0.85.0:255.255.255.0" \
    //   --netif-ipaddr 10.0.85.1 --netif-netmask 255.255.255.0 \
    //   --socks-server-addr 127.0.0.1:1081 \
    //   --socks5-udp --udp-relay-addr 127.0.0.1:1081
    const args: string[] = [];
    args.push(
        '--tundev',
        `tap0901:${TUN2SOCKS_TAP_DEVICE_NAME}:${TUN2SOCKS_TAP_DEVICE_IP}:${
            TUN2SOCKS_TAP_DEVICE_NETWORK}:${TUN2SOCKS_VIRTUAL_ROUTER_NETMASK}`);
    args.push('--netif-ipaddr', TUN2SOCKS_VIRTUAL_ROUTER_IP);
    args.push('--netif-netmask', TUN2SOCKS_VIRTUAL_ROUTER_NETMASK);
    args.push('--socks-server-addr', `${PROXY_IP}:${SS_LOCAL_PORT}`);
    args.push('--socks5-udp');
    args.push('--udp-relay-addr', `${PROXY_IP}:${SS_LOCAL_PORT}`);
    args.push('--loglevel', 'error');

    try {
      tun2socks = spawn(pathToEmbeddedExe('badvpn-tun2socks'), args);

      tun2socks.on('exit', (code, signal) => {
        if (signal) {
          // tun2socks exits with SIGTERM when we stop it.
          sentryLogger.info(`tun2socks exited with signal ${signal}`);
        } else {
          sentryLogger.info(`tun2socks exited with code ${code}`);
          if (code === 1) {
            // tun2socks exits with code 1 upon failure. When the machine sleeps, tun2socks exits
            // due to a failure to read the tap device.
            // Restart tun2socks with a timeout so the event kicks in when the device wakes up.
            sentryLogger.info('Restarting tun2socks...');
            setTimeout(() => {
              startTun2socks(host, onDisconnected).then(() => {
                sentryLogger.info('Re-configuring routing, waiting 5s for tun2socks to come up...');
                configureRoutingWithDelay(host, TUN2SOCKS_PROCESS_WAIT_TIME_MS).catch((e) => {
                  sentryLogger.error('Failed to re-configure routing');
                  teardownVpn();
                  onDisconnected();
                  return;
                });
              });
            }, 3000);
            return;
          }
        }
        onDisconnected();
      });

      // Ignore stdio if not consuming the process output (pass  {stdio: 'igonore'} to spawn);
      // otherwise the process execution is suspended when the unconsumed streams exceed the system
      // limit (~200KB). See https://github.com/nodejs/node/issues/4236
      tun2socks.stdout.on('data', (data) => {
        sentryLogger.error(`${data}`);
      });

      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

function stopSsLocal() {
  if (!ssLocal) {
    return Promise.resolve();
  }
  ssLocal.kill();
  return Promise.resolve();
}

function stopTun2socks() {
  if (!tun2socks) {
    return Promise.resolve();
  }
  tun2socks.kill();
  return Promise.resolve();
}

function configureRoutingWithDelay(host: string, delayMs: number) {
  return new Promise((F, R) => {
    setTimeout(() => {
        try {
          configureRouting(TUN2SOCKS_VIRTUAL_ROUTER_IP, host);
          F();
        } catch (e) {
          R(e);
        }
      }, delayMs);
  });
}

function configureRouting(tun2socksVirtualRouterIp: string, proxyServer: string) {
  // TODO: disable logging to Sentry in this method (logs will contain IPs) after Trusted Tester release.
  try {
    const out = execFileSync(
        pathToEmbeddedExe('setsystemroute'), ['on', TUN2SOCKS_VIRTUAL_ROUTER_IP, proxyServer]);
    sentryLogger.info(`setsystemroute:\n===\n${out}===`);

    // Store the current proxy server and gateway, for when we disconnect.
    currentProxyServer = proxyServer;
    const lines = out.toString().split('\n');
    const gatewayLines = lines.filter((line) => {
      return line.startsWith('current gateway:');
    });
    if (gatewayLines.length < 1) {
      throw new Error(`could not determine previous gateway`);
    }
    const tokens = gatewayLines[0].split(' ');
    const p = tokens[tokens.length - 1];
    console.log(`previous gateway: ${p}`);
    previousGateway = p;
  } catch (e) {
    sentryLogger.error(`setsystemroute failed:\n===\n${e.stdout.toString()}===`);
    console.log(e);
    throw new Error(`could not configure routing`);
  }
}

function resetRouting() {
  // TODO: disable logging to Sentry in this method (logs will contain IPs) after Trusted Tester release.
  if (!previousGateway) {
    throw new Error('i do not know the previous gateway');
  }
  if (!currentProxyServer) {
    throw new Error('i do not know the current proxy server');
  }
  try {
    const out = execFileSync(
        pathToEmbeddedExe('setsystemroute'),
        ['off', TUN2SOCKS_VIRTUAL_ROUTER_IP, currentProxyServer, previousGateway]);
    sentryLogger.info(`setsystemroute:\n===\n${out}===`);
  } catch (e) {
    sentryLogger.error(`setsystemroute failed:\n===\n${e.stdout.toString()}===`);
    throw new Error(`could not reset routing`);
  }
}

export function teardownVpn() {
  try {
    resetRouting();
  } catch (e) {
    sentryLogger.error(`failed to reset routing: ${e.message}`);
  }
  return Promise.all([stopSsLocal(), stopTun2socks()]);
}
