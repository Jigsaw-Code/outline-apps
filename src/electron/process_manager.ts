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
import {powerMonitor} from 'electron';
import {platform} from 'os';

import * as errors from '../www/model/errors';

import {checkUdpForwardingEnabled, isServerReachable, validateServerCredentials} from './connectivity';
import {RoutingDaemon} from './routing_service';
import {pathToEmbeddedBinary} from './util';

const isLinux = platform() === 'linux';
const isWindows = platform() === 'win32';

const PROXY_ADDRESS = '127.0.0.1';
const PROXY_PORT = 1081;

const TUN2SOCKS_TAP_DEVICE_NAME = isLinux ? 'outline-tun0' : 'outline-tap0';
const TUN2SOCKS_TAP_DEVICE_IP = '10.0.85.2';
const TUN2SOCKS_VIRTUAL_ROUTER_IP = '10.0.85.1';
const TUN2SOCKS_TAP_DEVICE_NETWORK = '10.0.85.0';
const TUN2SOCKS_VIRTUAL_ROUTER_NETMASK = '255.255.255.0';

// ss-local will almost always start, and fast: short timeouts, fast retries.
const SSLOCAL_CONNECTION_TIMEOUT = 10;
const SSLOCAL_MAX_ATTEMPTS = 30;
const SSLOCAL_RETRY_INTERVAL_MS = 100;

// Raises an error if:
//  - the TAP device does not exist
//  - the TAP device does not have the expected IP/subnet
//
// Note that this will *also* throw if netsh is not on the PATH. If that's the case then the
// installer should have failed, too.
//
// Only works on Windows!
//
// TODO: Probably should be moved to a new file, e.g. configuation.ts.
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
  // set interface interface="Ethernet" forwarding=enabled advertise=enabled nud=enabled
  // ignoredefaultroutes=disabled set interface interface="outline-tap0" forwarding=enabled
  // advertise=enabled nud=enabled ignoredefaultroutes=disabled add address name="outline-tap0"
  // address=10.0.85.2 mask=255.255.255.0
  //
  // popd
  // # End of IPv4 configuration
  const lines = execSync(`netsh interface ipv4 dump`).toString().split('\n');

  // Find lines containing the TAP device name.
  const tapLines = lines.filter(s => s.indexOf(TUN2SOCKS_TAP_DEVICE_NAME) !== -1);
  if (tapLines.length < 1) {
    throw new errors.SystemConfigurationException(`TAP device not found`);
  }

  // Within those lines, search for the expected IP.
  if (tapLines.filter(s => s.indexOf(TUN2SOCKS_TAP_DEVICE_IP) !== -1).length < 1) {
    throw new errors.SystemConfigurationException(`TAP device has wrong IP`);
  }
}

// Establishes a full-system VPN with the help of Outline's routing daemon and child processes
// ss-local and tun2socks. Follows the Mediator pattern in that none of the three "helpers" know
// anything about the others.
//
// In addition to the basic lifecycle of the three helper processes, this There are a couple of
export class ConnectionManager {
  // Fulfills once all three helpers have started successfully.
  static async create(config: cordova.plugins.outline.ServerConfig, isAutoConnect: boolean) {
    if (isWindows) {
      testTapDevice();
    }

    // ss-local must be up and running before we can test whether UDP is available (and, if
    // isAutoConnect is true, that the supplied credentials are valid). So, create an instance now
    // and "re-use" it by passing it to the constructed object.
    return new Promise<ConnectionManager>((fulfill, reject) => {
      const ssLocal = new SsLocal(PROXY_PORT);
      ssLocal.onExit = () => {
        reject(new Error('ss-local exited during UDP check'));
      };
      ssLocal.start(config);

      isServerReachable(
          PROXY_ADDRESS, PROXY_PORT, SSLOCAL_CONNECTION_TIMEOUT, SSLOCAL_MAX_ATTEMPTS,
          SSLOCAL_RETRY_INTERVAL_MS)
          .then(() => {
            // Don't validate credentials on boot: if the key was revoked, we want the system to
            // stay "connected" so that traffic doesn't leak.
            if (isAutoConnect) {
              return;
            }
            return validateServerCredentials(PROXY_ADDRESS, PROXY_PORT);
          })
          .then(() => {
            return checkUdpForwardingEnabled(PROXY_ADDRESS, PROXY_PORT);
          })
          .then((udpEnabled) => {
            console.log(`UDP support: ${udpEnabled}`);
            return RoutingDaemon.create(config.host || '', isAutoConnect).then((routing) => {
              fulfill(new ConnectionManager(routing, ssLocal, udpEnabled));
            });
          })
          .catch((e) => {
            ssLocal.stop();
            reject(e);
          });
    });
  }

  private tun2socks = new Tun2socks(PROXY_ADDRESS, PROXY_PORT);

  // Extracted out to an instance variable because in certain situations, notably a change in UDP
  // support, we need to stop and restart tun2socks *without notifying the client* and this allows
  // us swap the listener in and out.
  private tun2socksExitListener?: () => void | undefined;

  private readonly onAllHelpersStopped: Promise<void>;

  private reconnectingListener?: () => void;

  private reconnectedListener?: () => void;

  private constructor(
      private readonly routing: RoutingDaemon, private readonly ssLocal: SsLocal,
      private udpEnabled: boolean) {
    // This trio of Promises, each tied to a helper process' exit, is key to the instance's
    // lifecycle:
    //  - once any helper fails or exits, stop them all
    //  - once *all* helpers have stopped, we're done
    const exits = [
      this.routing.onceDisconnected.then(() => {
        console.log(`disconnected from routing daemon`);
      }),
      new Promise<void>((fulfill) => {
        this.ssLocal.onExit = () => {
          console.log(`ss-local terminated`);
          fulfill();
        };
      }),
      new Promise<void>((fulfill) => {
        this.tun2socksExitListener = () => {
          console.log(`tun2socks terminated`);
          fulfill();
        };
        this.tun2socks.onExit = this.tun2socksExitListener;
      })
    ];
    Promise.race(exits).then(this.stop.bind(this));
    this.onAllHelpersStopped = Promise.all(exits).then(() => {});

    // Handle network changes and, on Windows, suspend events.
    this.routing.onNetworkChange = this.networkChanged.bind(this);
    if (isWindows) {
      powerMonitor.on('suspend', this.suspendListener.bind(this));
    }

    // Finally, launch tun2socks. This may immediately fail but that's okay: the exit listener will
    // be invoked and the connection and all helpers (asynchronously) torn down.
    this.tun2socks.start(udpEnabled);
  }

  private networkChanged(status: ConnectionStatus) {
    if (status === ConnectionStatus.CONNECTED) {
      // Re-test whether UDP is available and, if necessary, (silently) restart tun2socks.
      checkUdpForwardingEnabled(PROXY_ADDRESS, PROXY_PORT)
          .then(
              (udpNowEnabled) => {
                if (udpNowEnabled === this.udpEnabled) {
                  console.log('no change in UDP availability');
                  if (this.reconnectedListener) {
                    this.reconnectedListener();
                  }
                  return;
                }

                console.log(`UDP support change: ${this.udpEnabled} -> ${udpNowEnabled}`);
                this.udpEnabled = udpNowEnabled;

                // Swap out the current listener, restart once the current process exits.
                this.tun2socks.onExit = () => {
                  console.log('terminated tun2socks for UDP change');

                  this.tun2socks.onExit = this.tun2socksExitListener;
                  this.tun2socks.start(this.udpEnabled);

                  if (this.reconnectedListener) {
                    this.reconnectedListener();
                  }
                };

                this.tun2socks.stop();
              },
              (e) => {
                // TODO: We can't just tear down the connection as traffic will leak.
                console.error(`could not test for UDP availability: ${e.message}`);
              });
    } else if (status === ConnectionStatus.RECONNECTING) {
      if (this.reconnectingListener) {
        this.reconnectingListener();
      }
    } else {
      console.error(`unknown network change status ${status} from routing daemon`);
    }
  }

  private suspendListener() {
    // Swap out the current listener, restart once the system resumes.
    this.tun2socks.onExit = () => {
      console.log('stopped tun2socks in preparation for suspend');
    };

    powerMonitor.once('resume', () => {
      console.log('restarting tun2socks');
      checkUdpForwardingEnabled(PROXY_ADDRESS, PROXY_PORT)
          .then(
              (udpNowEnabled) => {
                console.log(`UDP support: ${udpNowEnabled}`);
                this.udpEnabled = udpNowEnabled;

                this.tun2socks.onExit = this.tun2socksExitListener;
                this.tun2socks.start(this.udpEnabled);

                if (this.reconnectedListener) {
                  this.reconnectedListener();
                }
              },
              (e) => {
                // TODO: We can't just tear down the connection as traffic will leak.
                console.error(`could not test for UDP availability: ${e.message}`);
              });
    });
  }

  // Returns synchronously: use #onceStopped to be notified when all helper processes exit.
  stop() {
    powerMonitor.removeListener('suspend', this.suspendListener);

    try {
      this.routing.stop();
    } catch (e) {
      // This can happen for several reasons, e.g. the daemon may have stopped while we were
      // connected.
      console.error(`could not stop routing: ${e.message}`);
    }

    this.ssLocal.stop();
    this.tun2socks.stop();
  }

  // Fulfills once all three helper processes have stopped.
  //
  // When this happens, *as many changes made to the system in order to establish the full-system
  // VPN as possible* will have been reverted.
  public get onceStopped() {
    return this.onAllHelpersStopped;
  }

  // Sets an optional callback for when the routing daemon is attempting to re-connect.
  public set onReconnecting(newListener: () => void|undefined) {
    this.reconnectingListener = newListener;
  }

  // Sets an optional callback for when the routing daemon successfully reconnects.
  public set onReconnected(newListener: () => void|undefined) {
    this.reconnectedListener = newListener;
  }
}

// Simple "one shot" child process launcher.
//
// NOTE: Because there is no way in Node.js to tell whether a process launched successfully,
//       #startInternal always succeeds; use #onExit to be notified when the process has exited
//       (which may be immediately after calling #startInternal if, e.g. the binary cannot be
//       found).
class ChildProcessHelper {
  private process?: ChildProcess;

  private exitListener?: () => void;

  constructor(private path: string) {}

  protected launch(args: string[]) {
    this.process = spawn(this.path, args);

    const onExit = () => {
      if (this.process) {
        this.process.removeAllListeners();
        this.process = undefined;
      }
      if (this.exitListener) {
        this.exitListener();
      }
    };

    // We have to listen for both events: error means the process could not be launched and in that
    // case exit will not be invoked.
    this.process.on('error', onExit.bind((this)));
    this.process.on('exit', onExit.bind((this)));
  }

  // Returns synchronously: use #onExit to be notified when the process exits.
  stop() {
    if (this.process) {
      this.process.kill();
    }
  }

  set onExit(newListener: (() => void)|undefined) {
    this.exitListener = newListener;
  }
}

class SsLocal extends ChildProcessHelper {
  constructor(private readonly proxyPort: number) {
    super(pathToEmbeddedBinary('shadowsocks-libev', 'ss-local'));
  }

  start(config: cordova.plugins.outline.ServerConfig) {
    // ss-local -s x.x.x.x -p 65336 -k mypassword -m aes-128-cfb -l 1081 -u
    const args = ['-l', this.proxyPort.toString()];
    args.push('-s', config.host || '');
    args.push('-p', '' + config.port);
    args.push('-k', config.password || '');
    args.push('-m', config.method || '');
    args.push('-t', '5');
    args.push('-u');

    this.launch(args);
  }
}

class Tun2socks extends ChildProcessHelper {
  constructor(private proxyAddress: string, private proxyPort: number) {
    super(pathToEmbeddedBinary('badvpn', 'badvpn-tun2socks'));
  }

  start(udpEnabled: boolean) {
    // ./badvpn-tun2socks.exe \
    //   --tundev "tap0901:outline-tap0:10.0.85.2:10.0.85.0:255.255.255.0" \
    //   --netif-ipaddr 10.0.85.1 --netif-netmask 255.255.255.0 \
    //   --socks-server-addr 127.0.0.1:1081 \
    //   --socks5-udp --udp-relay-addr 127.0.0.1:1081 \
    //   --transparent-dns
    const args: string[] = [];
    args.push(
        '--tundev',
        isLinux ? TUN2SOCKS_TAP_DEVICE_NAME :
                  `tap0901:${TUN2SOCKS_TAP_DEVICE_NAME}:${TUN2SOCKS_TAP_DEVICE_IP}:${
                      TUN2SOCKS_TAP_DEVICE_NETWORK}:${TUN2SOCKS_VIRTUAL_ROUTER_NETMASK}`);
    args.push('--netif-ipaddr', TUN2SOCKS_VIRTUAL_ROUTER_IP);
    args.push('--netif-netmask', TUN2SOCKS_VIRTUAL_ROUTER_NETMASK);
    args.push('--socks-server-addr', `${this.proxyAddress}:${this.proxyPort}`);
    args.push('--loglevel', 'error');
    args.push('--transparent-dns');
    if (udpEnabled) {
      args.push('--socks5-udp');
      args.push('--udp-relay-addr', `${this.proxyAddress}:${this.proxyPort}`);
    }

    this.launch(args);
  }
}
