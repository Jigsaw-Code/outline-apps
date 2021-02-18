// Copyright 2021 The Outline Authors
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

import {powerMonitor} from 'electron';
import {platform} from 'os';

import {TunnelStatus} from '../www/app/tunnel';
import * as errors from '../www/model/errors';
import {ShadowsocksConfig} from '../www/model/shadowsocks';

import {RoutingDaemon} from './routing_service';
import {ChildProcessHelper} from './process';
import {testTapDevice} from './tap';
import {pathToEmbeddedBinary} from './util';
import {VpnTunnel} from './vpn_tunnel';

const isLinux = platform() === 'linux';
const isWindows = platform() === 'win32';

const TUN2SOCKS_TAP_DEVICE_NAME = isLinux ? 'outline-tun0' : 'outline-tap0';
const TUN2SOCKS_TAP_DEVICE_IP = '10.0.85.2';
const TUN2SOCKS_VIRTUAL_ROUTER_IP = '10.0.85.1';
const TUN2SOCKS_VIRTUAL_ROUTER_NETMASK = '255.255.255.0';

// Cloudflare and Quad9 resolvers.
const DNS_RESOLVERS = ['1.1.1.1', '9.9.9.9'];

// Establishes a full-system VPN with the help of Outline's routing daemon and child process
// outline-go-tun2socks. Follows the Mediator pattern in that none of the "helpers" know anything
// about the others.
//
// In addition to the basic lifecycle of the helper processes, this class restarts tun2socks
// on network changes if necessary.
export class GoVpnTunnel implements VpnTunnel {
  private readonly routing: RoutingDaemon;
  private readonly tun2socks: GoTun2socks;

  // Extracted out to an instance variable because in certain situations, notably a change in UDP
  // support, we need to stop and restart tun2socks *without notifying the client* and this allows
  // us swap the listener in and out.
  private tun2socksExitListener?: () => void | undefined;

  // See #resumeListener.
  private terminated = false;

  private isUdpEnabled = false;

  private readonly onAllHelpersStopped: Promise<void>;

  private reconnectingListener?: () => void;

  private reconnectedListener?: () => void;

  constructor(private config: ShadowsocksConfig, private isAutoConnect: boolean) {
    this.routing = new RoutingDaemon(config.host || '', isAutoConnect);
    this.tun2socks = new GoTun2socks(config);

    // This pair of Promises, each tied to a helper process' exit, is key to the instance's
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
      this.disconnect();
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

  // Turns on verbose logging for the managed processes. Must be called before launching the processes
  enableDebugMode() {
    this.tun2socks.enableDebugMode();
  }

  // Fulfills once all three helpers have started successfully.
  async connect() {
    if (isWindows) {
      testTapDevice(TUN2SOCKS_TAP_DEVICE_NAME, TUN2SOCKS_TAP_DEVICE_IP);
    }

    // Don't check connectivity on boot: if the key was revoked, we want the system to stay
    // "connected" so that traffic doesn't leak.
    if (!this.isAutoConnect) {
      this.isUdpEnabled = await checkConnectivity(this.config);
    }
    console.log(`UDP support: ${this.isUdpEnabled}`);
    this.tun2socks.start(this.isUdpEnabled);

    await this.routing.start();
  }

  private networkChanged(status: TunnelStatus) {
    if (status === TunnelStatus.CONNECTED) {
      if (this.reconnectedListener) {
        this.reconnectedListener();
      }

      // Test whether UDP availability has changed; since it won't change 99% of the time, do this
      // *after* we've informed the client we've reconnected.
      this.retestUdp();
    } else if (status === TunnelStatus.RECONNECTING) {
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
      console.error('resume event invoked but this tunnel is terminated - doing nothing');
      return;
    }

    console.log('restarting tun2socks after resume');

    this.tun2socks.onExit = this.tun2socksExitListener;
    this.tun2socks.start(this.isUdpEnabled);

    // Check if UDP support has changed; if so, silently restart.
    this.retestUdp();
  }

  private async retestUdp() {
    const wasUdpEnabled = this.isUdpEnabled;
    try {
      this.isUdpEnabled = await checkConnectivity(this.config);
    } catch (e) {
      console.error(`connectivity checks failed: ${e}`);
      return;
    }
    if (this.isUdpEnabled === wasUdpEnabled) {
      return;
    }

    console.log(`UDP support change: now ${this.isUdpEnabled}`);

    // Swap out the current listener, restart once the current process exits.
    this.tun2socks.onExit = () => {
      console.log('restarting tun2socks');
      this.tun2socks.onExit = this.tun2socksExitListener;
      this.tun2socks.start(this.isUdpEnabled);
    };
    this.tun2socks.stop();
  }

  // Use #onceDisconnected to be notified when the tunnel terminates.
  async disconnect() {
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
  get onceDisconnected() {
    return this.onAllHelpersStopped;
  }

  // Sets an optional callback for when the routing daemon is attempting to re-connect.
  onReconnecting(newListener: () => void|undefined) {
    this.reconnectingListener = newListener;
  }

  // Sets an optional callback for when the routing daemon successfully reconnects.
  onReconnected(newListener: () => void|undefined) {
    this.reconnectedListener = newListener;
  }
}


// outline-go-tun2socks is a Go program that processes IP traffic from a TUN/TAP device
// and relays it to a Shadowsocks proxy server.
class GoTun2socks extends ChildProcessHelper {

  constructor(private config: ShadowsocksConfig, private checkConnectivity = false) {
    super(pathToEmbeddedBinary('outline-go-tun2socks', 'tun2socks'));
  }

  start(isUdpEnabled: boolean) {
    // ./tun2socks.exe \
    //   -tunName outline-tap0 -tunDNS 1.1.1.1,9.9.9.9 \
    //   -tunAddr 10.0.85.2 -tunGw 10.0.85.1 -tunMask 255.255.255.0 \
    //   -proxyHost 127.0.0.1 -proxyPort 1080 -proxyPassword mypassword \
    //   -proxyCipher chacha20-ietf-poly1035 [-dnsFallback] [-checkConnectivity]
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
    args.push('-logLevel', this.isInDebugMode ? 'debug' : 'warn');
    if (this.checkConnectivity) {
      // Checks connectivity and exits with an error code as defined in `errors.ErrorCode`
      // -tun* and -dnsFallback options have no effect on this mode.
      args.push('-checkConnectivity');
    }
    if (!isUdpEnabled) {
      args.push('-dnsFallback');
    }
    this.launch(args);
  }
}

// Leverages the outline-go-tun2socks binary to check connectivity to the server specified in `config`.
// Checks whether proxy server is reachable, whether the network and proxy support UDP forwarding
// and validates the proxy credentials.
// Resolves with a boolean indicating whether UDP forwarding is supported.
// Throws if any of the checks fail or if the process fails to start.
async function checkConnectivity(config: ShadowsocksConfig) {
  const tun2socks = new GoTun2socks(config, true);
  return new Promise<boolean>((resolve, reject) => {
    tun2socks.onExit = (code?: number) => {
      if (code === errors.ErrorCode.NO_ERROR || code === errors.ErrorCode.UDP_RELAY_NOT_ENABLED) {
        // Don't treat lack of UDP support as an error, relay to the caller.
        resolve(code === errors.ErrorCode.NO_ERROR);
      } else {
        // Treat the absence of a code as an unexpected error.
        reject(errors.fromErrorCode(code ?? errors.ErrorCode.UNEXPECTED));
      }
    };
    tun2socks.start(true);
  });
}
