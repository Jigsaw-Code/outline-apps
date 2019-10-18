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
// tun2socks. Follows the Mediator pattern in that none of the three "helpers" know
// anything about the others.
//
// In addition to the basic lifecycle of the three helper processes, this handles a few special
// situations:
//  - repeat the UDP test when the network changes and restart tun2socks if the result has changed
//  - silently restart tun2socks when the system is about to suspend (Windows only)
export class ConnectionManager {
  private readonly routing: RoutingDaemon;
  private readonly tun2socks: Tun2socks;

  // Extracted out to an instance variable because in certain situations, notably a change in UDP
  // support, we need to stop and restart tun2socks *without notifying the client* and this allows
  // us swap the listener in and out.
  private tun2socksExitListener?: () => void | undefined;

  // See #resumeListener.
  private terminated = false;

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
      new Promise<void>((fulfill) => {
        this.tun2socksExitListener = fulfill;
        this.tun2socks.onExit = this.tun2socksExitListener;
      })
    ];
    Promise.race(exits).then(() => {
      console.log('a helper has exited, disconnecting');
      this.stop();
    });
    this.onAllHelpersStopped = Promise.all(exits).then(() => {
      console.log('all helpers have exited');
      this.terminated = true;
    });

    // Handle network changes and, on Windows, suspend events.
    this.routing.onNetworkChange = this.networkChanged.bind(this);
    if (isWindows) {
      powerMonitor.on('suspend', this.suspendListener.bind(this));
      powerMonitor.on('resume', this.resumeListener.bind((this)));
    }
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

  private networkChanged(status: ConnectionStatus) {
    if (status === ConnectionStatus.CONNECTED) {
      if (this.reconnectedListener) {
        this.reconnectedListener();
      }

      // Test whether UDP availability has changed; since it won't change 99% of the time, do this
      // *after* we've informed the client we've reconnected.
      this.restartTun2socks();
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
  }

  private resumeListener() {
    if (this.terminated) {
      // NOTE: Cannot remove resume listeners - Electron bug?
      console.error('resume event invoked but this connection is terminated - doing nothing');
      return;
    }

    console.log('restarting tun2socks after resume');

    this.tun2socks.onExit = this.tun2socksExitListener;
    this.tun2socks.start(!this.isAutoConnect);

    // Check if UDP support has changed.
    this.restartTun2socks();
  }

  private async restartTun2socks() {
    // Swap out the current listener, restart once the current process exits.
    this.tun2socks.onExit = () => {
      console.log('restarting tun2socks');
      this.tun2socks.onExit = this.tun2socksExitListener;
      // Check connectivity to test whether UDP is supported in the new network.
      this.tun2socks.start(true);
    };
    this.tun2socks.stop();
  }

  // Use #onceStopped to be notified when the connection terminates.
  stop() {
    powerMonitor.removeListener('suspend', this.suspendListener.bind(this));
    powerMonitor.removeListener('resume', this.resumeListener.bind(this));

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

  protected exitListener?: (code?: number, signal?: string) => void;
  protected stdoutListener?: (data?: string | Buffer) => void;

  constructor(private path: string) {}

  protected launch(args: string[]) {
    this.process = spawn(this.path, args);

    const onExit = (code?: number, signal?: string) => {
      if (this.process) {
        this.process.removeAllListeners();
      }
      if (this.exitListener) {
        this.exitListener(code, signal);
      }
    };

    const onStdoutData = (data?: string | Buffer) => {
      if (this.stdoutListener) {
        this.stdoutListener(data);
      }
    };

    // We have to listen for both events: error means the process could not be launched and in that
    // case exit will not be invoked.
    this.process.on('error', onExit.bind((this)));
    this.process.on('exit', onExit.bind((this)));
    this.process.stdout.on('data', onStdoutData.bind(this));
    this.process.stderr.on('data', onStdoutData.bind(this));
  }

  // Use #onExit to be notified when the process exits.
  stop() {
    if (!this.process) {
      // Never started.
      if (this.exitListener) {
        this.exitListener();
      }
      return;
    }

    this.process.kill();
  }

  set onExit(newListener: (() => void)|undefined) {
    this.exitListener = newListener;
  }

  set onStdout(newListener: ((data?: string | Buffer) => void) | undefined) {
    this.stdoutListener = newListener;
  }
}

class Tun2socks extends ChildProcessHelper {
  constructor(private config: cordova.plugins.outline.ServerConfig) {
    super(pathToEmbeddedBinary('go-tun2socks', 'tun2socks'));
  }

  async start(checkConnectivity: boolean) {
    // ./tun2socks.exe \
    //   -tunName outline-tap0" \
    //   -tunAddr 10.0.85.2 -tunGw 10.0.85.1 -tunMask 255.255.255.0 \
    //   -proxyHost 127.0.0.1 -proxyPort 1080 -proxyPassword mypassword \
    //   -proxyCipher chacha20-ietf-poly1035 -checkConnectivity
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
    this.launch(args);

    const exitListener = this.exitListener;

    // Declare success when tun2socks is running.
    const running = new Promise(resolve => {
      this.onStdout = (data?: string | Buffer) => {
        if (data && data.toString().includes('tun2socks running')) {
          this.onStdout = undefined;
          this.onExit = exitListener;  // Restore previous exit listener
          resolve();
        }
      };
    });

    // Wait for an early exit due to connectvity failures.
    const earlyExit = new Promise((resolve, reject) => {
      this.onExit = (code?: number, signal?: string) => {
        console.log('tun2socks exited with code', code);
        if (exitListener) {
          exitListener();  // Execute previous exit listener
        }
        reject(errors.fromErrorCode(code || errors.ErrorCode.UNEXPECTED));
      };
    });

    return Promise.race([running, earlyExit]);
  }
}
