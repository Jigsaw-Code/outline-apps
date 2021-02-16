// Copyright 2020 The Outline Authors
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
import * as path from 'path';
import * as process from 'process';

import {TunnelStatus} from '../www/app/tunnel';
import * as errors from '../www/model/errors';
import {ShadowsocksConfig} from '../www/model/shadowsocks';

import {checkUdpForwardingEnabled, isServerReachable, validateServerCredentials} from './connectivity';
import {RoutingDaemon} from './routing_service';
import {pathToEmbeddedBinary} from './util';

const isLinux = platform() === 'linux';
const isWindows = platform() === 'win32';

const TUN2SOCKS_TAP_DEVICE_NAME = isLinux ? 'outline-tun0' : 'outline-tap0';
const TUN2SOCKS_TAP_DEVICE_IP = '10.0.85.2';
const TUN2SOCKS_VIRTUAL_ROUTER_IP = '10.0.85.1';
const TUN2SOCKS_TAP_DEVICE_NETWORK = '10.0.85.0';
const TUN2SOCKS_VIRTUAL_ROUTER_NETMASK = '255.255.255.0';

// ss-local will almost always start, and fast: short timeouts, fast retries.
const SSLOCAL_CONNECTION_TIMEOUT = 10;
const SSLOCAL_MAX_ATTEMPTS = 30;
const SSLOCAL_PROXY_ADDRESS = '127.0.0.1';
const SSLOCAL_PROXY_PORT = 1081;
const SSLOCAL_RETRY_INTERVAL_MS = 100;

// Cloudflare and Quad9 resolvers.
const DNS_RESOLVERS = ['1.1.1.1', '9.9.9.9'];

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

interface Process {
  start(): Promise<void>;
  stop(): void;
  onExit?: ((code: number) => void);
  enableDebugMode(): void;
}

interface ShadowsocksProcess extends Process {
  // Checks whether the network and proxy support UDP forwarding and validates
  // that the proxy credentials are valid. Throws an error if any of the checks fail.
  checkConnectivity(): Promise<void>;
}

interface Tun2socksProcess extends Process {
  isUdpEnabled: boolean;
}

// Establishes a full-system VPN with the help of Outline's routing daemon and child processes
// ss-local and tun2socks. Follows the Mediator pattern in that none of the three "helpers" know
// anything about the others.
//
// In addition to the basic lifecycle of the three helper processes, this handles a few special
// situations:
//  - repeat the UDP test when the network changes and restart tun2socks if the result has changed
//  - silently restart tun2socks when the system is about to suspend (Windows only)
export class TunnelManager {
  private readonly routing: RoutingDaemon;
  private readonly shadowsocks: ShadowsocksProcess;
  private readonly tun2socks: Tun2socksProcess;

  // Extracted out to an instance variable because in certain situations, notably a change in UDP
  // support, we need to stop and restart tun2socks *without notifying the client* and this allows
  // us swap the listener in and out.
  private tun2socksExitListener?: (code: number) => void | undefined;

  // See #resumeListener.
  private terminated = false;

  private readonly onAllHelpersStopped: Promise<void>;

  private reconnectingListener?: () => void;

  private reconnectedListener?: () => void;

  constructor(private config: ShadowsocksConfig, private isAutoConnect: boolean) {
    this.routing = new RoutingDaemon(config.host || '', isAutoConnect);
    this.shadowsocks = new SsLocal(config, SSLOCAL_PROXY_PORT);
    this.tun2socks = new BadvpnTun2socks(SSLOCAL_PROXY_ADDRESS, SSLOCAL_PROXY_PORT);
    // TODO(alalama): switch based on a build flag.
    // this.shadowsocks = new GoShadowsocks(config);
    // this.tun2socks = new GoTun2socks(config);

    // This trio of Promises, each tied to a helper process' exit, is key to the instance's
    // lifecycle:
    //  - once any helper fails or exits, stop them all
    //  - once *all* helpers have stopped, we're done
    const exits = [
      new Promise<number>((fulfill) => this.routing.onceDisconnected.then(fulfill.bind(null, 0))),
      new Promise<number>((fulfill) => this.shadowsocks.onExit = fulfill),
      new Promise<number>((fulfill) => {
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

  /**
   * Turns on verbose logging for the managed processes.  Must be called before launching the processes
   */
  public enableDebugMode() {
    this.shadowsocks.enableDebugMode();
    this.tun2socks.enableDebugMode();
  }

  // Fulfills once all three helpers have started successfully.
  async start() {
    if (isWindows) {
      testTapDevice();
    }

    // ss-local must be up in order to test UDP support and validate credentials.
    await this.shadowsocks.start();

    // Don't validate credentials on boot: if the key was revoked, we want the system to stay
    // "connected" so that traffic doesn't leak.
    // TODO(alalama): pass UDP support on auto-connect, currently we fallback to TCP by default.
    if (!this.isAutoConnect) {
      await this.checkConnectivity();
    }

    await this.tun2socks.start();
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
    this.tun2socks.start();

    // Check if UDP support has changed; if so, silently restart.
    this.retestUdp();
  }


  private async checkConnectivity() {
    try {
      await this.shadowsocks.checkConnectivity();
      this.tun2socks.isUdpEnabled = true;
    } catch(e) {
      if (!(e instanceof errors.RemoteUdpForwardingDisabled)) {
        throw e;
      }
      this.tun2socks.isUdpEnabled = true;
    }
  }

  private async retestUdp() {
    const wasUdpEnabled = this.tun2socks.isUdpEnabled;
    try {
      this.checkConnectivity();
    } catch (e) {
      console.error(`UDP test failed: ${e.message}`);
      return;
    }
    if (wasUdpEnabled === this.tun2socks.isUdpEnabled) {
      return;
    }

    console.log(`UDP support change: now ${this.tun2socks.isUdpEnabled}`);

    // Swap out the current listener, restart once the current process exits.
    this.tun2socks.onExit = () => {
      console.log('restarting tun2socks');
      this.tun2socks.onExit = this.tun2socksExitListener;
      this.tun2socks.start();
    };
    this.tun2socks.stop();
  }

  // Use #onceStopped to be notified when the tunnel terminates.
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

    this.shadowsocks.stop();
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
  protected isInDebugMode = false;

  private exitListener?: (code: number) => void;

  protected constructor(private path: string) {}

  /**
   * Starts the process with the given args. If enableDebug() has been called, then the process is started in verbose mode if supported.
   * @param args The args for the process
   */
  protected launch(args: string[]) {
    this.process = spawn(this.path, args);
    const processName = path.basename(this.path);

    const onExit = (code: number, signal: string) => {
      if (this.process) {
        this.process.removeAllListeners();
      }
      if (this.exitListener) {
        this.exitListener(code);
      }

      logExit(processName, code, signal);
    };

    if (this.isInDebugMode) {
      // Expose logs to the node output.  This also makes the logs available in Sentry.
      this.process.stdout.on('data', (data) => console.log(`[STDOUT - ${processName}]: ${data}`));
      this.process.stderr.on('data', (data) => console.error(`[STDERR - ${processName}]: ${data}`));
    }

    // We have to listen for both events: error means the process could not be launched and in that
    // case exit will not be invoked.
    this.process.on('error', onExit.bind((this)));
    this.process.on('exit', onExit.bind((this)));
  }

  // Use #onExit to be notified when the process exits.
  stop() {
    if (!this.process) {
      // Never started.
      if (this.exitListener) {
        this.exitListener(null);
      }
      return;
    }

    this.process.kill();
  }

  set onExit(newListener: ((code: number) => void)|undefined) {
    this.exitListener = newListener;
  }

  /**
   * Enables verbose logging for the process.  Must be called before launch().
   */
  enableDebugMode() {
    this.isInDebugMode = true;
  }
}

// shadowsocks-libev client program. Starts a local SOCKS proxy that relays TCP/UDP
// traffic to a Shadowsocks proxy server.
class SsLocal extends ChildProcessHelper implements ShadowsocksProcess {
  // Construct with the Shadowsocks proxy config and the local port to bind the SOCKS proxy.
  constructor(readonly config: ShadowsocksConfig, private readonly proxyPort: number) {
    super(pathToEmbeddedBinary('shadowsocks-libev', 'ss-local'));
  }

  async start() {
    // ss-local -s x.x.x.x -p 65336 -k mypassword -m chacha20-ietf-poly1035 -l 1081 -u
    const args = ['-l', this.proxyPort.toString()];
    args.push('-s', this.config.host || '');
    args.push('-p', '' + this.config.port);
    args.push('-k', this.config.password || '');
    args.push('-m', this.config.method || '');
    args.push('-u');
    if (this.isInDebugMode) {
      args.push('-v');
    }

    this.launch(args);
    return this.isSsLocalReachable();
  }

  async checkConnectivity() {
    // Possibly over-cautious, though we have seen occasional failures immediately after network
    // changes: ensure ss-local is reachable first.
    await this.isSsLocalReachable();
    // TODO(alalama): parallelize.
    try {
      await checkUdpForwardingEnabled(SSLOCAL_PROXY_ADDRESS, SSLOCAL_PROXY_PORT);
    } catch (udpErr) {
      await validateServerCredentials(SSLOCAL_PROXY_ADDRESS, SSLOCAL_PROXY_PORT);
      throw udpErr;
    }
  }

  private isSsLocalReachable() {
    return isServerReachable(
      SSLOCAL_PROXY_ADDRESS, SSLOCAL_PROXY_PORT, SSLOCAL_CONNECTION_TIMEOUT, SSLOCAL_MAX_ATTEMPTS,
      SSLOCAL_RETRY_INTERVAL_MS);
  }
}

// GoTun2socks implements the Shadowsocks protocol, so running a separate
// Shadowsocks process is not necessary.
// Stub process lifecycle to run connectivity checks through GoTun2socks.
class GoShadowsocks implements ShadowsocksProcess {
  private tun2socks: GoTun2socks;
  private exitListener?: () => void;

  constructor(private config: ShadowsocksConfig) {
    this.tun2socks = new GoTun2socks(config, true);
  }

  async start() {
    // noop
  }

  async stop() {
    if (this.exitListener) {
      this.exitListener();
    }
  }

  set onExit(listener: (() => void)|undefined) {
    this.exitListener = listener;
  }

  // Launches outline-go-tun2socks with the --checkConnectivity option.
  async checkConnectivity() {
    return new Promise<void>((resolve, reject)=> {
      this.tun2socks.onExit = (code: number) => {
        if (code !== errors.ErrorCode.NO_ERROR) {
          // Treat the absence of a code as an unexpected error.
          reject(errors.fromErrorCode(code ?? errors.ErrorCode.UNEXPECTED));
        }
        resolve();
      };
      this.tun2socks.start();
    });
  }

  enableDebugMode() {
    this.tun2socks.enableDebugMode();
  }
}

// Badvpn tun2socks is a program that processes IP traffic from a TUN/TAP device
// and relays it to a SOCKS proxy.
class BadvpnTun2socks extends ChildProcessHelper implements Tun2socksProcess {
  isUdpEnabled = false;

  // Construct with the SOCKS proxy address and port.
  constructor(private proxyAddress: string, private proxyPort: number) {
    super(pathToEmbeddedBinary('badvpn', 'badvpn-tun2socks'));
  }

  async start() {
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
    args.push('--transparent-dns');
    if (this.isUdpEnabled) {
      args.push('--socks5-udp');
      args.push('--udp-relay-addr', `${this.proxyAddress}:${this.proxyPort}`);
    }
    args.push('--loglevel', this.isInDebugMode ? 'info' : 'error');

    this.launch(args);
  }
}

// outline-go-tun2socks is a Go program that processes IP traffic from a TUN/TAP device
// and relays it to a Shadowsocks proxy server.
class GoTun2socks extends ChildProcessHelper implements Tun2socksProcess {
  isUdpEnabled = false;

  // Construct with the Shadowsocks proxy server configuration.
  constructor(private config: ShadowsocksConfig, private checkConnectivity = false) {
    super(pathToEmbeddedBinary('outline-go-tun2socks', 'tun2socks'));
  }

  async start() {
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
      args.push('-checkConnectivity');
    }
    if (!this.isUdpEnabled) {
      args.push('-dnsFallback');
    }
    this.launch(args);
  }

}

function logExit(processName: string, exitCode?: number, signal?: string) {
  const prefix = `[EXIT - ${processName}]: `;
  if (exitCode !== null) {
    const log = exitCode === 0 ? console.log : console.error;
    log(`${prefix}Exited with code ${exitCode}`);
  } else if (signal !== null) {
    const log = signal === 'SIGTERM' ? console.log : console.error;
    log(`${prefix}Killed by signal ${signal}`);
  } else {
    // This should never happen.  It likely signals an internal error in Node, as it is supposed to
    // always pass either an exit code or an exit signal to the exit handler.
    console.error(`${prefix}Process exited for an unknown reason.`);
  }
}
