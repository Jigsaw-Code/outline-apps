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

import {ChildProcess, execSync, spawn} from 'child_process';
import * as dgram from 'dgram';
import * as dns from 'dns';
import * as net from 'net';
import * as os from 'os';
import * as socks from 'socks';

import * as util from '../www/app/util';
import * as errors from '../www/model/errors';

import * as routing from './routing_service';
import {pathToEmbeddedBinary} from './util';

// Errors raised by spawn contain these extra fields, at least on Windows.
declare class SpawnError extends Error {
  // e.g. ENOENT
  code: string;
}

const delay = (time: number) => () => new Promise(resolve => setTimeout(() => resolve(), time));
const WAIT_FOR_PROCESS_TO_START_MS = 2000;

const isWindows = os.platform() === 'win32';
const isLinux = os.platform() === 'linux';

const routingService = new routing.RoutingService();

// Three tools are required to launch the proxy on Windows:
//  - ss-local.exe connects with the remote Shadowsocks server, exposing a SOCKS5 proxy
//  - badvpn-tun2socks.exe connects the SOCKS5 proxy to a TAP-like network interface
//  - OutlineService configures the system to route via a TAP-like network device, must be installed

let ssLocal: ChildProcess | undefined;
let tun2socks: ChildProcess | undefined;

const PROXY_IP = '127.0.0.1';
const SS_LOCAL_PORT = 1081;

const TUN2SOCKS_TAP_DEVICE_NAME = 'outline-tap0';
// TODO: read these from the network device!
const TUN2SOCKS_TAP_DEVICE_IP = '10.0.85.2';
const TUN2SOCKS_VIRTUAL_ROUTER_IP = '10.0.85.1';
const TUN2SOCKS_TAP_DEVICE_NETWORK = '10.0.85.0';
const TUN2SOCKS_VIRTUAL_ROUTER_NETMASK = '255.255.255.0';

const CREDENTIALS_TEST_DOMAINS = ['example.com', 'ietf.org', 'wikipedia.org'];
const SS_LOCAL_TIMEOUT_SECS =
  2 ^ 31 - 1;  // 32-bit INT_MAX; using Number.MAX_SAFE_VALUE may overflow
const REACHABILITY_TEST_TIMEOUT_MS = 10000;
const DNS_LOOKUP_TIMEOUT_MS = 10000;
const UDP_FORWARDING_TEST_TIMEOUT_MS = 5000;
const UDP_FORWARDING_TEST_RETRY_INTERVAL_MS = 1000;

// This function is roughly the Electron counterpart of Android's VpnTunnelService.startShadowsocks.
//
// Fulfills iff:
//  - the TAP device exists and is configured
//  - the shadowsocks and tun2socks binaries were started
//  - the system configured to route all traffic through the proxy
//  - the connectivity checks pass, if not automatically connecting on startup (e.g. !isAutoConnect)
//
// Fulfills with a copy of `serverConfig` that includes the resolved hostname.
export function startVpn(
    serverConfig: cordova.plugins.outline.ServerConfig,
    onConnectionStatusChange: (status: ConnectionStatus) => void,
    isAutoConnect = false): Promise<cordova.plugins.outline.ServerConfig> {
  // First, check that the TAP device exists and is configured.
  try {
    if (isWindows) {
      testTapDevice();
    }
  } catch (e) {
    return Promise.reject(new errors.SystemConfigurationException(e.message));
  }
  const onDisconnected = () => {
    onConnectionStatusChange(ConnectionStatus.DISCONNECTED);
  };
  const config = Object.assign({}, serverConfig);
  return startLocalShadowsocksProxy(config, onDisconnected)
      .then(delay(isLinux ? WAIT_FOR_PROCESS_TO_START_MS : 0))
      .then(() => {
        if (isAutoConnect) {
          return;
        }
        // Only perform the connectivity checks when we're not automatically connecting on boot,
        // since we may not have network connectivity.
        return checkConnectivity(config).then((ip) => {
          // Cache the resolved IP so it can be stored for auto connect.
          config.host = ip;
        });
      })
      .then(() => {
        return getTunDeviceName();
      })
      .then((tunDeviceName) => {
        return startTun2socks(onDisconnected, tunDeviceName);
      })
      .then(delay(isLinux ? WAIT_FOR_PROCESS_TO_START_MS : 0))
      .then(() => {
        return routingService.configureRouting(
            TUN2SOCKS_VIRTUAL_ROUTER_IP, config.host || '', onConnectionStatusChange,
            isAutoConnect);
      })
      .then(() => {
        return config;
      })
      .catch((e) => {
        stopProcesses();
        throw e;
      });
}

// Raises an error if:
//  - the TAP device does not exist
//  - the TAP device does not have the expected IP/subnet
//
// Note that this will *also* throw if netsh is not on the PATH. If that's the case then the
// installer should have failed, too.
function testTapDevice() {
  // Sample output:
  // =============
  // $ netsh interface ipv4 dump
  // # ----------------------------------
  // # IPv4 Configuration
  // # ----------------------------------
  // pushd interface ipv4
  //
  // reset
  // set global icmpredirects=disabled
  // set interface interface="Ethernet" forwarding=enabled advertise=enabled nud=enabled ignoredefaultroutes=disabled
  // set interface interface="outline-tap0" forwarding=enabled advertise=enabled nud=enabled ignoredefaultroutes=disabled
  // add address name="outline-tap0" address=10.0.85.2 mask=255.255.255.0
  //
  // popd
  // # End of IPv4 configuration
  const lines = execSync(`netsh interface ipv4 dump`).toString().split('\n');

  // Find lines containing the TAP device name.
  const tapLines = lines.filter(s => s.indexOf(TUN2SOCKS_TAP_DEVICE_NAME) !== -1);
  if (tapLines.length < 1) {
    throw new Error(`TAP device not found`);
  }

  // Within those lines, search for the expected IP.
  if (tapLines.filter(s => s.indexOf(TUN2SOCKS_TAP_DEVICE_IP) !== -1).length < 1) {
    throw new Error(`TAP device has wrong IP`);
  }
}

// Fulfills iff:
//  - we can connect to the Shadowsocks server port
//  - the remote server has enabled UDP forwarding
//  - we can speak with a semi-random test site via the proxy
function checkConnectivity(config: cordova.plugins.outline.ServerConfig): Promise<string> {
  return lookupIp(config.host || '').then((ip: string) => {
    return isServerReachableByIp(ip, config.port || 0)
      .then(() => {
        return validateServerCredentials();
      })
      .then(() => {
        return checkUdpForwardingEnabled();
      })
      .then(() => {
        return ip;
      });
  });
}
// Uses the OS' built-in functions, i.e. /etc/hosts, et al.:
// https://nodejs.org/dist/latest-v10.x/docs/api/dns.html#dns_dns
//
// Effectively a no-op if hostname is already an IP.
function lookupIp(hostname: string): Promise<string> {
  return util.timeoutPromise(
    new Promise<string>((fulfill, reject) => {
      dns.lookup(hostname, 4, (e, address) => {
        if (e) {
          return reject(new errors.ServerUnreachable('could not resolve proxy server hostname'));
        }
        fulfill(address);
      });
    }),
    DNS_LOOKUP_TIMEOUT_MS, 'DNS lookup');
}

// Resolves with true iff a TCP connection can be established with the Shadowsocks server.
//
// This has the same function as ShadowsocksConnectivity.isServerReachable in
// cordova-plugin-outline.
export function isServerReachable(config: cordova.plugins.outline.ServerConfig) {
  return lookupIp(config.host || '').then((ip) => {
    return isServerReachableByIp(ip, config.port || 0);
  });
}

// As #isServerReachable but does not perform a DNS lookup.
export function isServerReachableByIp(serverIp: string, serverPort: number) {
  return util.timeoutPromise(
    new Promise<void>((fulfill, reject) => {
      const socket = new net.Socket();
      socket
        .connect(
          { host: serverIp, port: serverPort },
          () => {
            socket.end();
            fulfill();
          })
        .on('error', () => {
          reject(new errors.ServerUnreachable());
        });
    }),
    REACHABILITY_TEST_TIMEOUT_MS, 'Reachability check');
}

function startLocalShadowsocksProxy(
  serverConfig: cordova.plugins.outline.ServerConfig, onDisconnected: () => void) {
  return new Promise((resolve, reject) => {
    // ss-local -s x.x.x.x -p 65336 -k mypassword -m aes-128-cfb -l 1081 -u
    const ssLocalArgs = ['-l', SS_LOCAL_PORT.toString()];
    ssLocalArgs.push('-s', serverConfig.host || '');
    ssLocalArgs.push('-p', '' + serverConfig.port);
    ssLocalArgs.push('-k', serverConfig.password || '');
    ssLocalArgs.push('-m', serverConfig.method || '');
    ssLocalArgs.push('-t', SS_LOCAL_TIMEOUT_SECS.toString());
    ssLocalArgs.push('-u');

    // Note that if you run with -v then ss-local may output a lot of data to stderr which
    // will cause the binary to fail:
    //   https://nodejs.org/dist/latest-v10.x/docs/api/child_process.html#child_process_maxbuffer_and_unicode
    ssLocal = spawn(pathToEmbeddedBinary('ss-local'), ssLocalArgs);

    if (ssLocal === undefined) {
      reject(new errors.ShadowsocksStartFailure(`Unable to spawn ss-local`));
    }

    // Amazingly, there's no documented way to tell whether spawn has successfully launched a
    // binary. This handler allows us to implicitly test that, by listening for ss-local's
    // "listening on port xxx" startup output.
    //
    // AZ - In *nix world std*'s are buffered so we can't use this method
    // added a delay after this for now. We need a better solution - maybe node-ps
    if (isLinux) {
      resolve();
    } else {
      ssLocal.stdout.once('data', (s) => {
        resolve();
      });
    }

    // In addition to being a sensible way to listen for launch failures, setting this handler
    // prevents an "uncaught promise" exception from being raised and sent to Sentry. We *do not
    // want to send that exception to Sentry* since it contains ss-local's arguments which
    // encode an access key to the server.
    ssLocal.on('error', (e: SpawnError) => {
      reject(new errors.ShadowsocksStartFailure(`ss-local failed with code ${e.code}`));
    });

    ssLocal.on('exit', (code, signal) => {
      // We assume any signal sent to ss-local was sent by us.
      if (signal) {
        console.info(`ss-local exited with signal ${signal}`);
      } else {
        console.info(`ss-local exited with code ${code}`);
      }
      onDisconnected();
    });
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
        proxy: { ipaddress: PROXY_IP, port: SS_LOCAL_PORT, type: 5 },
        target: { host: testDomain, port: 80 }
      },
      (e, socket) => {
        if (e) {
          reject(new errors.InvalidServerCredentials(
            `could not connect to remote test website: ${e.message}`));
          return;
        }

        socket.write(`HEAD / HTTP/1.1\r\nHost: ${testDomain}\r\n\r\n`);

        socket.on('data', (data) => {
          if (data.toString().startsWith('HTTP/1.1')) {
            socket.end();
            fulfill();
          } else {
            socket.end();
            reject(new errors.InvalidServerCredentials(
              `unexpected response from remote test website`));
          }
        });

        socket.on('close', () => {
          reject(new errors.InvalidServerCredentials(`could not connect to remote test website`));
        });

        // Sockets must be resumed before any data will come in, as they are paused right before
        // this callback is fired.
        socket.resume();
      });
  });
}

// Verifies that the remote server has enabled UDP forwarding by sending a DNS request through it.
function checkUdpForwardingEnabled() {
  return new Promise((resolve, reject) => {
    socks.createConnection(
      {
        proxy: { ipaddress: PROXY_IP, port: SS_LOCAL_PORT, type: 5, command: 'associate' },
        target: { host: '0.0.0.0', port: 0 },  // Specify the actual target once we get a response.
      },
      (err, socket, info) => {
        if (err) {
          reject(new errors.RemoteUdpForwardingDisabled(`could not connect to local proxy`));
          return;
        }
        const dnsRequest = getDnsRequest();
        const packet = socks.createUDPFrame({ host: '1.1.1.1', port: 53 }, dnsRequest);
        const udpSocket = dgram.createSocket('udp4');

        udpSocket.on('error', (e) => {
          reject(new errors.RemoteUdpForwardingDisabled('UDP socket failure'));
        });

        udpSocket.on('message', (msg, info) => {
          stopUdp();
          resolve();
        });

        // Retry sending the query every second.
        // TODO: logging here is a bit verbose
        const intervalId = setInterval(() => {
          try {
            udpSocket.send(packet, info.port, info.host, (err) => {
              if (err) {
                console.error(`Failed to send data through UDP: ${err}`);
              }
            });
          } catch (e) {
            console.error(`Failed to send data through UDP ${e}`);
          }
        }, UDP_FORWARDING_TEST_RETRY_INTERVAL_MS);

        const stopUdp = () => {
          try {
            clearInterval(intervalId);
            udpSocket.close();
          } catch (e) {
            // Ignore; there may be multiple calls to this function.
          }
        };

        // Give up after the timeout elapses.
        setTimeout(() => {
          stopUdp();
          reject(new errors.RemoteUdpForwardingDisabled());
        }, UDP_FORWARDING_TEST_TIMEOUT_MS);
      });
  });
}

// Returns a buffer containing a DNS request to google.com.
function getDnsRequest() {
  return Buffer.from([
    0, 0,                             // [0-1]   query ID
    1, 0,                             // [2-3]   flags; byte[2] = 1 for recursion desired (RD).
    0, 1,                             // [4-5]   QDCOUNT (number of queries)
    0, 0,                             // [6-7]   ANCOUNT (number of answers)
    0, 0,                             // [8-9]   NSCOUNT (number of name server records)
    0, 0,                             // [10-11] ARCOUNT (number of additional records)
    6, 103, 111, 111, 103, 108, 101,  // google
    3, 99, 111, 109,                  // com
    0,                                // null terminator of FQDN (root TLD)
    0, 1,                             // QTYPE, set to A
    0, 1                              // QCLASS, set to 1 = IN (Internet)
  ]);
}

function startTun2socks(onDisconnected: () => void, tunDeviceName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // ./badvpn-tun2socks.exe \
    //   --tundev "tap0901:outline-tap0:10.0.85.2:10.0.85.0:255.255.255.0" \
    //   --netif-ipaddr 10.0.85.1 --netif-netmask 255.255.255.0 \
    //   --socks-server-addr 127.0.0.1:1081 \
    //   --socks5-udp --udp-relay-addr 127.0.0.1:1081

    const args: string[] = [];
    args.push('--tundev', tunDeviceName);
    args.push('--netif-ipaddr', TUN2SOCKS_VIRTUAL_ROUTER_IP);
    args.push('--netif-netmask', TUN2SOCKS_VIRTUAL_ROUTER_NETMASK);
    args.push('--socks-server-addr', `${PROXY_IP}:${SS_LOCAL_PORT}`);
    args.push('--socks5-udp');
    args.push('--udp-relay-addr', `${PROXY_IP}:${SS_LOCAL_PORT}`);
    args.push('--loglevel', 'error');

    // TODO: Duplicate ss-local's error handling.
    try {
      tun2socks = spawn(pathToEmbeddedBinary('badvpn-tun2socks'), args);

      // Ignore stdio if not consuming the process output (pass {stdio: 'igonore'} to spawn);
      // otherwise the process execution is suspended when the unconsumed streams exceed the
      // system limit (~200KB). See https://github.com/nodejs/node/issues/4236
      tun2socks.stdout.on('data', (s) => {
        console.error(`${s}`);
        resolve();
      });
      tun2socks.on('exit', (code, signal) => {
        if (signal) {
          // tun2socks exits with SIGTERM when we stop it.
          console.info(`tun2socks exited with signal ${signal}`);
        } else {
          console.info(`tun2socks exited with code ${code}`);
          if (!isLinux && code === 1) {
            // tun2socks exits with code 1 upon failure. When the machine sleeps, tun2socks exits
            // due to a failure to read the tap device.
            // Restart tun2socks with a timeout so the event kicks in when the device wakes up.
            console.info('Restarting tun2socks...');
            setTimeout(() => {
              getTunDeviceName()
                  .then((tunDeviceName) => {
                    startTun2socks(onDisconnected, tunDeviceName);
                  })
                  .then(() => {
                    resolve();
                  })
                  .catch((e) => {
                    console.error('Failed to restart tun2socks');
                    onDisconnected();
                    teardownVpn();
                  });
            }, 3000);
            return;
          }
        }
        onDisconnected();
      });

      tun2socks.stderr.on('data', (data) => {
        console.log(`stderr: ${data}`);
      });

      // In addition to being a sensible way to listen for launch failures, setting this handler
      // prevents an "uncaught promise" exception from being raised and sent to Sentry. We *do not
      // want to send that exception to Sentry* since it contains tun2socks's arguments which
      // has sensitive information
      tun2socks.on('error', (e: SpawnError) => {
        reject(new errors.ShadowsocksStartFailure(`tun2socks failed with code ${e.code}`));
      });

      resolve();
    } catch (e) {
      // We haven't seen any failures related to tun2socks so use this error because it will make
      // the UI point the user towards antivirus software, which seems the most likely culprit for
      // tun2socks failing to launch.
      reject(new errors.ShadowsocksStartFailure(`could not start tun2socks`));
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

export function teardownVpn() {
  return Promise.all([
    routingService.resetRouting().catch((e) => {
      console.error(`could not reset routing: ${e.message}`);
    }),
    stopProcesses()
  ]);
}

function getTunDeviceName(): Promise<string> {
  if (isWindows) {
    return Promise.resolve(`tap0901:${TUN2SOCKS_TAP_DEVICE_NAME}:${TUN2SOCKS_TAP_DEVICE_IP}:${
        TUN2SOCKS_TAP_DEVICE_NETWORK}:${TUN2SOCKS_VIRTUAL_ROUTER_NETMASK}`);
  } else if (isLinux) {
    return routingService.getDeviceName();
  } else {
    return Promise.reject(new Error(`unsupported platform`));
  }
}

function stopProcesses() {
  return Promise.all([stopSsLocal(), stopTun2socks()]);
}
