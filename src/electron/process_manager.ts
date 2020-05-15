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

import {execSync} from 'child_process';
import {powerMonitor} from 'electron';
import {platform} from 'os';

import * as errors from '../www/model/errors';

import {ChildProcessHelper} from './child_process';
import {ShadowsocksConnectivity} from './connectivity';
import {RoutingDaemon} from './routing_service';
import {pathToEmbeddedBinary} from './util';

const isLinux = platform() === 'linux';
const isWindows = platform() === 'win32';

const TUN2SOCKS_TAP_DEVICE_NAME = isLinux ? 'outline-tun0' : 'outline-tap0';
const TUN2SOCKS_TAP_DEVICE_IP = '10.0.85.2';
const TUN2SOCKS_VIRTUAL_ROUTER_IP = '10.0.85.1';
const TUN2SOCKS_VIRTUAL_ROUTER_NETMASK = '255.255.255.0';

// Cloudflare, Quad9, and OpenDNS resolvers.
const DNS_RESOLVERS = ['1.1.1.1', '9.9.9.9', '208.67.222.222'];

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
}

// Establishes a full-system VPN with the help of Outline's routing daemon and child process
// tun2socks. Follows the Mediator pattern in that none of the "helpers" know anything about
// the others.
//
// In addition to the basic lifecycle of the helper processes, this class restarts tun2socks
// on network changes if necessary.
export class ConnectionManager {
  private readonly routing: RoutingDaemon;
  private readonly tun2socks: Tun2socks;

  private readonly onAllHelpersStopped: Promise<void>;
  private reconnectingListener?: () => void;
  private reconnectedListener?: () => void;

  constructor(
    config: cordova.plugins.outline.ServerConfig, private isAutoConnect: boolean) {
    this.tun2socks = new Tun2socks(config);
    this.routing = new RoutingDaemon(config.host || '', isAutoConnect);

    // These Promises, each tied to a helper process' exit, are key to the instance's
    // lifecycle:
    //  - once any helper fails or exits, stop them all
    //  - once *all* helpers have stopped, we're done
    const exits = [
      this.routing.onceDisconnected,
      this.tun2socks.onceStopped
    ];
    Promise.race(exits).then(() => {
      console.log('a helper has exited, disconnecting');
      this.stop();
    });
    this.onAllHelpersStopped = Promise.all(exits).then(() => {
      console.log('all helpers have exited');
    });

    this.routing.onNetworkChange = this.networkChanged.bind(this);
  }

  // Fulfills once the VPN has started successfully.
  async start() {
    if (isWindows) {
      testTapDevice();
    }

    // Don't perform connectivity checks on boot: if the key was revoked, we want the system
    // to stay "connected" so that traffic doesn't leak.
    await this.tun2socks.start(!this.isAutoConnect);
    await this.routing.start();
  }

  private async networkChanged(status: ConnectionStatus) {
    if (status === ConnectionStatus.CONNECTED) {
      // Notify tun2socks about the network change so it can restart if UDP connectivity has changed.
      try {
        await this.tun2socks.networkChanged();
      } catch (e) {
        // Don't tear down the VPN in case this is a transient network error.
        console.error(`Connectivity checks failed: ${e}`);
      }

      if (this.reconnectedListener) {
        this.reconnectedListener();
      }
    } else if (status === ConnectionStatus.RECONNECTING) {
      if (this.reconnectingListener) {
        this.reconnectingListener();
      }
    } else {
      console.error(`unknown network change status ${status} from routing daemon`);
    }
  }

  // Use #onceStopped to be notified when the connection terminates.
  stop() {
    try {
      this.routing.stop();
    } catch (e) {
      // This can happen for several reasons, e.g. the daemon may have stopped while we were
      // connected.
      console.error(`could not stop routing: ${e.message}`);
    }

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

// Class to manage the lifecycle of tun2socks.
class Tun2socks {
  private process?: ChildProcessHelper;
  private isUdpEnabled = false;

  private resolveStop!: () => void;
  private readonly stopped = new Promise<void>(resolve => {
    this.resolveStop = resolve;
  });

  constructor(private config: cordova.plugins.outline.ServerConfig) {}

  // Starts the tun2socks process. Restarts the process if it is already running.
  // Checks the server's connectivity when `checkConnectivity` is true, throwing on failure.
  async start(checkConnectivity: boolean) {
    if (checkConnectivity) {
      try {
        await this.checkConnectivity();
        console.log(`UDP support: ${this.isUdpEnabled}`);
      } catch (e) {
        this.resolveStop();
        throw e;
      }
    }

    if (!!this.process && this.process.isRunning) {
      // Restart once the current process exits. Stop the process without resolving `stopped`.
      await this.process.stop();
      console.log('restarting tun2socks');
    }

    this.process = new ChildProcessHelper(pathToEmbeddedBinary('go-tun2socks', 'tun2socks'),
                                          this.getProcessArgs());

    return new Promise((resolve, reject) => {
      // Declare success when tun2socks is running.
      this.process!.onStderr = (data?: string | Buffer) => {
        if (data && data.toString().includes('tun2socks running')) {
          this.process!.onStderr = undefined;
          if (isWindows) {
            powerMonitor.removeAllListeners();
            powerMonitor.once('suspend', this.suspendListener);
            powerMonitor.once('resume', this.resumeListener);
          }
          resolve();
        }
      };

      // Reject on early exit.
      this.process!.onExit.then((code?: number) => {
        console.log('tun2socks exited with code', code);
        this.resolveStop();
        reject(errors.fromErrorCode(code || errors.ErrorCode.UNEXPECTED));
      });
    });
  }

  // Stops the tun2socks process. Notifies the caller when the process has exited
  // by resolving `onceStopped`.
  stop() {
    if (!this.process) {
      return;
    }
    if (isWindows) {
      powerMonitor.removeAllListeners();
    }
    this.process.stop().then(this.resolveStop);
  }

  get onceStopped(): Promise<void> {
    return this.stopped;
  }

  // Notifes tun2socks that network connectivity changed. Checks whether UDP support changed,
  // restarting if it did.
  async networkChanged() {
    const wasUdpEnabled = this.isUdpEnabled;
    await this.checkConnectivity();
    if (this.isUdpEnabled === wasUdpEnabled) {
      return;
    }
    console.log(`UDP support changed: ${this.isUdpEnabled}`);
    return this.start(false);
  }

  private async checkConnectivity() {
    const ssConn = new ShadowsocksConnectivity(this.config);
    const code = await ssConn.onceResult;
    if (code !== errors.ErrorCode.NO_ERROR && code !== errors.ErrorCode.UDP_RELAY_NOT_ENABLED) {
      // Treat the absence of a code as an unexpected error.
      throw errors.fromErrorCode(code || errors.ErrorCode.UNEXPECTED);
    }
    this.isUdpEnabled = code === errors.ErrorCode.NO_ERROR;
  }

  private suspendListener = () => {
    console.log('system suspending');
    // Windows: when the system suspends, tun2socks terminates due to the TAP device getting closed.
    // Preemptively stop tun2socks without resolving `stopped`.
    if (this.process) {
      this.process.stop();
    }
  }

  private resumeListener = () => {
    console.log('system resuming');
    // Windows: restart tun2socks after suspend; don't check connectivity.
    this.start(false);
  }

  private getProcessArgs(): string[] {
    // ./tun2socks.exe \
    //   -tunName outline-tap0 -tunDNS 1.1.1.1,9.9.9.9 \
    //   -tunAddr 10.0.85.2 -tunGw 10.0.85.1 -tunMask 255.255.255.0 \
    //   -proxyHost 127.0.0.1 -proxyPort 1080 -proxyPassword mypassword \
    //   -proxyCipher chacha20-ietf-poly1035 [-dnsFallback]
    const args: string[] = [];
    args.push('-tunName', TUN2SOCKS_TAP_DEVICE_NAME);
    args.push('-tunAddr', TUN2SOCKS_TAP_DEVICE_IP);
    args.push('-tunGw', TUN2SOCKS_VIRTUAL_ROUTER_IP);
    args.push('-tunMask', TUN2SOCKS_VIRTUAL_ROUTER_NETMASK);
    args.push('-tunDNS', DNS_RESOLVERS.join(','));
    args.push('-proxyHost', this.config.host || '');
    args.push('-proxyPort', `${this.config.port}`);
    args.push('-proxyPassword', this.config.password || '');
    args.push('-proxyCipher', this.config.method || '');
    args.push('-logLevel', 'info');
    if (!this.isUdpEnabled) {
      args.push('-dnsFallback');
    }
    return args;
  }
}
