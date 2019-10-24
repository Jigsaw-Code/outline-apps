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
// on network changes to perform connectivity checks.
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

    // These Promises, each tied to a helper process' exit, is key to the instance's
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

    // Handle network changes and, on Windows, suspend events.
    this.routing.onNetworkChange = this.networkChanged.bind(this);
  }

  // Fulfills once all three helpers have started successfully.
  async start() {
    if (isWindows) {
      testTapDevice();
    }

    // Don't validate credentials on boot: if the key was revoked, we want the system to stay
    // "connected" so that traffic doesn't leak.
    await this.tun2socks.start(!this.isAutoConnect);

    await this.routing.start();
  }

  private async networkChanged(status: ConnectionStatus) {
    if (status === ConnectionStatus.CONNECTED) {
      // (Re)start tun2socks to check for changes in UDP connectivity.
      // Windows: following a system suspend/resume, this will start tun2socks.
      await this.tun2socks.start(true);

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

// Simple "one shot" child process launcher.
//
// NOTE: Because there is no way in Node.js to tell whether a process launched successfully,
//       #startInternal always succeeds; use #onExit to be notified when the process has exited
//       (which may be immediately after calling #startInternal if, e.g. the binary cannot be
//       found).
class ChildProcessHelper {
  private process?: ChildProcess;
  private running = false;

  private resolveExit!: (code?: number) => void;
  private exited = new Promise<number>(resolve => {
    this.resolveExit = resolve;
  });
  private stdErrListener?: (data?: string | Buffer) => void;

  constructor(private path: string) {}

  launch(args: string[]) {
    this.process = spawn(this.path, args);
    this.running = true;

    const onExit = (code?: number, signal?: string) => {
      this.running = false;
      if (this.process) {
        this.process.removeAllListeners();
      }
      this.resolveExit(code);
      // Recreate the exit promise to support re-launching.
      this.exited = new Promise<number>(F => {
        this.resolveExit = F;
      });
    };

    const onStdErr = (data?: string | Buffer) => {
      if (this.stdErrListener) {
        this.stdErrListener(data);
      }
    };

    // We have to listen for both events: error means the process could not be launched and in that
    // case exit will not be invoked.
    this.process.on('error', onExit.bind((this)));
    this.process.on('exit', onExit.bind((this)));
    this.process.stderr.on('data', onStdErr.bind(this));
  }

  // Use #onExit to be notified when the process exits.
  stop() {
    if (!this.process) {
      // Never started.
      this.resolveExit();
      return;
    }

    this.process.kill();
    this.process = undefined;
  }

  get onExit(): Promise<number> {
    return this.exited;
  }

  set onStderr(newListener: ((data?: string | Buffer) => void) | undefined) {
    this.stdErrListener = newListener;
  }

  get isRunning(): boolean {
    return this.running;
  }
}

// Class to manage the lifecycle of tun2socks.
class Tun2socks {
  private process: ChildProcessHelper;

  private notifyStop = true;
  private resolveStop!: () => void;
  private readonly stopped = new Promise<void>(resolve => {
    this.resolveStop = resolve;
  });

  constructor(private config: cordova.plugins.outline.ServerConfig) {
    this.process = new ChildProcessHelper(pathToEmbeddedBinary('go-tun2socks', 'tun2socks'));
  }

  // Starts the tun2socks process. Restarts the process if it is already running.
  async start(checkConnectivity: boolean) {
    if (this.process.isRunning) {
      // Restart once the current process exits without notifying the exit.
      this.stop(false);
      await this.process.onExit;
      console.log('restarting tun2socks');
    }

    this.process.launch(this.getProcessArgs(checkConnectivity));

    return new Promise((resolve, reject) => {
      // Declare success when tun2socks is running.
      this.process.onStderr = (data?: string | Buffer) => {
        if (data && data.toString().includes('tun2socks running')) {
          this.process.onStderr = undefined;
          this.notifyStop = true;
          if (isWindows) {
            powerMonitor.once('suspend', this.suspendListener);
          }
          resolve();
        }
      };

      this.process.onExit.then((code?: number) => {
        console.log('tun2socks exited with code', code);
        if (!this.notifyStop) {
          return;
        }
        this.resolveStop();
        // On routine exit, this promise will have already been resolved.
        // Reject on early exit due to connectvity failures.
        // code === 0 should not happen unless invoked with `-version`;
        // treat it like an unexpected error.
        reject(errors.fromErrorCode(code || errors.ErrorCode.UNEXPECTED));
      });
    });
  }

  // Stops the tun2socks process. Notifies the caller when the process has exited
  // by resolving `onceStopped` if `notify` is true.
  stop(notify=true) {
    if (isWindows) {
      powerMonitor.removeListener('suspend', this.suspendListener);
    }
    this.notifyStop = notify;
    this.process.stop();
  }

  get onceStopped(): Promise<void> {
    return this.stopped;
  }

  private suspendListener = () => {
    console.log('system suspending');
    // Windows: when the system suspends, tun2socks terminates due to the TAP device getting closed.
    // Preemptively stop the process without notifying its exit.
    this.stop(false);
  }

  private getProcessArgs(checkConnectivity: boolean): string[] {
    // ./tun2socks.exe \
    //   -tunName outline-tap0 -tunDNS 1.1.1.1,9.9.9.9 \
    //   -tunAddr 10.0.85.2 -tunGw 10.0.85.1 -tunMask 255.255.255.0 \
    //   -proxyHost 127.0.0.1 -proxyPort 1080 -proxyPassword mypassword \
    //   -proxyCipher chacha20-ietf-poly1035 [-checkConnectivity]
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
    if (checkConnectivity) {
      args.push('-checkConnectivity');
    }
    return args;
  }
}
