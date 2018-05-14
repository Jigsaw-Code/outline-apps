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
import * as net from 'net';
import * as path from 'path';
import * as process from 'process';
import * as socks from 'socks';
import * as url from 'url';

// TODO: These should probably be pulled up a level now that Electron code also uses them.
import * as util from '../www/app/util';
import * as errors from '../www/model/errors';

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

// TODO: read these from the network device!
const TUN2SOCKS_TAP_DEVICE_IP = '10.0.85.2';
const TUN2SOCKS_VIRTUAL_ROUTER_IP = '10.0.85.1';
const TUN2SOCKS_TAP_DEVICE_NETWORK = '10.0.85.0';
const TUN2SOCKS_VIRTUAL_ROUTER_NETMASK = '255.255.255.0';

let previousGateway: string;
let currentProxyServer: string;

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
        return startLocalShadowsocksProxy(config, onDisconnected);
      })
      .catch((e) => {
        throw errors.ErrorCode.SHADOWSOCKS_START_FAILURE;
      })
      .then(() => {
        return validateServerCredentials();
      })
      .catch((e) => {
        throw errors.ErrorCode.INVALID_SERVER_CREDENTIALS;
      })
      .then(() => {
        return startTun2socks(onDisconnected);
      })
      .catch((e) => {
        throw errors.ErrorCode.HTTP_PROXY_START_FAILURE;
      })
      .then((port) => {
        // there is a slight delay before tun2socks
        // correctly configures the virtual router. before then,
        // configuring the route table will not work as expected.
        // TODO: hack tun2socks to write something to stdout when it's ready
        return new Promise((F, R) => {
          console.log('waiting 5s for tun2socks to come up...');
          setTimeout(() => {
            try {
              configureRouting(TUN2SOCKS_VIRTUAL_ROUTER_IP, config.host || '');
              F();
            } catch (e) {
              R(e);
            }
          }, 5000);
        });
      })
      .catch((e) => {
        throw errors.ErrorCode.CONFIGURE_SYSTEM_PROXY_FAILURE;
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
      ssLocal = execFile(pathToEmbeddedExe('ss-local'), ssLocalArgs);

      ssLocal.on('exit', (code, signal) => {
        // We assume any signal sent to ss-local was sent by us.
        if (signal) {
          console.log(`ss-local exited with signal ${signal}`);
          onDisconnected();
          return;
        }

        console.log(`ss-local exited with code ${code}`);
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

function startTun2socks(onDisconnected: () => void): Promise<void> {
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

    try {
      tun2socks = execFile(pathToEmbeddedExe('badvpn-tun2socks'), args);

      tun2socks.on('exit', (code, signal) => {
        if (signal) {
          console.log(`tun2socks exited with signal ${signal}`);
        } else {
          console.log(`tun2socks exited with code ${code}`);
        }
        onDisconnected();
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

function configureRouting(tun2socksVirtualRouterIp: string, proxyServer: string) {
  try {
    const out = execFileSync(
        pathToEmbeddedExe('setsystemroute'), ['on', TUN2SOCKS_VIRTUAL_ROUTER_IP, proxyServer]);
    console.log(`setsystemroute:\n===\n${out}===`);

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
    console.log(`setsystemroute failed:\n===\n${e.stdout.toString()}===`);
    console.log(e);
    throw new Error(`could not configure routing`);
  }
}

function resetRouting() {
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
    console.log(`setsystemroute:\n===\n${out}===`);
  } catch (e) {
    console.log(`setsystemroute failed:\n===\n${e.stdout.toString()}===`);
    throw new Error(`could not reset routing`);
  }
}

export function teardownProxy() {
  try {
    resetRouting();
  } catch (e) {
    console.log(`failed to reset routing: ${e.message}`);
  }
  return Promise.all([stopSsLocal(), stopTun2socks()]);
}
