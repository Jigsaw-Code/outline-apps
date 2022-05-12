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

import {execSync} from 'child_process';
import * as dgram from 'dgram';
import {powerMonitor} from 'electron';
import {platform} from 'os';
import * as socks from 'socks';

import {ShadowsocksConfig} from '../www/app/config';
import {TunnelStatus} from '../www/app/tunnel';
import * as errors from '../www/model/errors';

import {isServerReachable} from './connectivity';
import {ChildProcessHelper} from './process';
import {RoutingDaemon} from './routing_service';
import {pathToEmbeddedBinary} from './util';
import {VpnTunnel} from './vpn_tunnel';

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
const SSLOCAL_PROXY_HOST = '127.0.0.1';
const SSLOCAL_PROXY_PORT = 1081;
const SSLOCAL_RETRY_INTERVAL_MS = 100;

const CREDENTIALS_TEST_DOMAINS = ['example.com', 'ietf.org', 'wikipedia.org'];

const UDP_FORWARDING_TEST_TIMEOUT_MS = 5000;
const UDP_FORWARDING_TEST_RETRY_INTERVAL_MS = 1000;

// Raises an error if:
//  - the TAP device does not exist
//  - the TAP device does not have the expected IP/subnet
//
// Note that this will *also* throw if netsh is not on the PATH. If that's the case then the
// installer should have failed, too.
//
// Only works on Windows!
function testTapDevice(tapDeviceName: string, tapDeviceIp: string) {
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
  const lines = execSync(`netsh interface ipv4 dump`)
    .toString()
    .split('\n');

  // Find lines containing the TAP device name.
  const tapLines = lines.filter(s => s.indexOf(tapDeviceName) !== -1);
  if (tapLines.length < 1) {
    throw new errors.SystemConfigurationException(`TAP device not found`);
  }

  // Within those lines, search for the expected IP.
  if (tapLines.filter(s => s.indexOf(tapDeviceIp) !== -1).length < 1) {
    throw new errors.SystemConfigurationException(`TAP device has wrong IP`);
  }
}

async function isSsLocalReachable() {
  await isServerReachable(
    SSLOCAL_PROXY_HOST,
    SSLOCAL_PROXY_PORT,
    SSLOCAL_CONNECTION_TIMEOUT,
    SSLOCAL_MAX_ATTEMPTS,
    SSLOCAL_RETRY_INTERVAL_MS
  );
}

// Establishes a full-system VPN with the help of Outline's routing daemon and child processes
// ss-local and badvpn-tun2socks. ss-local listens on a local SOCKS server and forwards TCP and UDP
// traffic through Shadowsocks. badvpn-tun2socks processes traffic from a TAP device and relays to
// a SOCKS proxy. The routing service modifies the routing table so that the TAP device receives all
// device traffic.
//
// |TAP| <-> |badvpn-tun2socks| <-> |ss-local| <-> |Shadowsocks proxy|
//
// In addition to the basic lifecycle of the three helper processes, this handles a few special
// situations:
//  - repeat the UDP test when the network changes and restart tun2socks if the result has changed
//  - silently restart tun2socks when the system is about to suspend (Windows only)
//
// Follows the Mediator pattern in that none of the three "helpers" know
// anything about the others.
export class ShadowsocksLibevBadvpnTunnel implements VpnTunnel {
  private readonly ssLocal = new SsLocal(SSLOCAL_PROXY_PORT);
  private readonly tun2socks = new BadvpnTun2socks(SSLOCAL_PROXY_HOST, SSLOCAL_PROXY_PORT);

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

  constructor(private readonly routing: RoutingDaemon, private config: ShadowsocksConfig) {
    // This trio of Promises, each tied to a helper process' exit, is key to the instance's
    // lifecycle:
    //  - once any helper fails or exits, stop them all
    //  - once *all* helpers have stopped, we're done
    const ssLocalExit = new Promise<void>(resolve => {
      this.ssLocal.onExit = () => {
        resolve();
      };
    });
    const tun2socksExit = new Promise<void>(resolve => {
      this.tun2socksExitListener = resolve;
      this.tun2socks.onExit = this.tun2socksExitListener;
    });
    const exits = [this.routing.onceDisconnected, ssLocalExit, tun2socksExit];
    Promise.race(exits).then(() => {
      console.log('a helper has exited, disconnecting');
      this.disconnect();
    });
    this.onAllHelpersStopped = Promise.all(exits).then(() => {
      console.log('all helpers have exited');
      this.terminated = true;
    });
  }

  /**
   * Turns on verbose logging for the managed processes.  Must be called before launching the
   * processes
   */
  enableDebugMode() {
    this.ssLocal.enableDebugMode();
    this.tun2socks.enableDebugMode();
  }

  // Fulfills once all three helpers have started successfully.
  async connect(checkProxyConnectivity: boolean) {
    if (isWindows) {
      testTapDevice(TUN2SOCKS_TAP_DEVICE_NAME, TUN2SOCKS_TAP_DEVICE_IP);

      // Windows: when the system suspends, tun2socks terminates due to the TAP device getting
      // closed.
      powerMonitor.on('suspend', this.suspendListener.bind(this));
      powerMonitor.on('resume', this.resumeListener.bind(this));
    }

    // ss-local must be up in order to test UDP support and validate credentials.
    this.ssLocal.start(this.config);
    await isSsLocalReachable();

    if (checkProxyConnectivity) {
      await validateServerCredentials(SSLOCAL_PROXY_HOST, SSLOCAL_PROXY_PORT);
      this.isUdpEnabled = await checkUdpForwardingEnabled(SSLOCAL_PROXY_HOST, SSLOCAL_PROXY_PORT);
    }

    console.log(`UDP support: ${this.isUdpEnabled}`);
    this.tun2socks.start(this.isUdpEnabled);

    await this.routing.start();
  }

  networkChanged(status: TunnelStatus) {
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
      // Possibly over-cautious, though we have seen occasional failures immediately after network
      // changes: ensure ss-local is reachable first.
      await isSsLocalReachable();
      this.isUdpEnabled = await checkUdpForwardingEnabled(SSLOCAL_PROXY_HOST, SSLOCAL_PROXY_PORT);
    } catch (e) {
      console.error(`UDP test failed: ${e.message}`);
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
    console.info('disconnecting from libev badvpn tunnel...');

    powerMonitor.removeListener('suspend', this.suspendListener.bind(this));
    powerMonitor.removeListener('resume', this.resumeListener.bind(this));

    // This is the clean shutdown order, but to minimize delay, we don't
    // wait for each shutdown step to complete.  They may therefore complete
    // out of order.  This will cause tun2socks to print error messages in
    // the console, but is otherwise harmless.
    this.tun2socks.stop();
    this.ssLocal.stop();

    try {
      await this.routing.stop();
      console.info('disconnected from libev badvpn tunnel');
    } catch (e) {
      // This can happen for several reasons, e.g. the daemon may have stopped while we were
      // connected.
      console.error(`could not stop routing: ${e.message}`);
    }
  }

  // Fulfills once all three helper processes have stopped.
  //
  // When this happens, *as many changes made to the system in order to establish the full-system
  // VPN as possible* will have been reverted.
  get onceDisconnected() {
    return this.onAllHelpersStopped;
  }

  // Sets an optional callback for when the routing daemon is attempting to re-connect.
  onReconnecting(newListener: () => void | undefined) {
    this.reconnectingListener = newListener;
  }

  // Sets an optional callback for when the routing daemon successfully reconnects.
  onReconnected(newListener: () => void | undefined) {
    this.reconnectedListener = newListener;
  }
}

class SsLocal extends ChildProcessHelper {
  constructor(private readonly proxyPort: number) {
    super(pathToEmbeddedBinary('shadowsocks-libev', 'ss-local'));
  }

  start(config: ShadowsocksConfig) {
    // ss-local -s x.x.x.x -p 65336 -k mypassword -m chacha20-ietf-poly1035 -l 1081 -u
    const args = ['-l', this.proxyPort.toString()];
    args.push('-s', config.host || '');
    args.push('-p', `${config.port}`);
    args.push('-k', config.password || '');
    args.push('-m', config.method || '');
    args.push('-u');
    if (this.isInDebugMode) {
      args.push('-v');
    }

    this.launch(args);
  }
}

class BadvpnTun2socks extends ChildProcessHelper {
  constructor(private proxyAddress: string, private proxyPort: number) {
    super(pathToEmbeddedBinary('badvpn', 'badvpn-tun2socks'));
  }

  start(isUdpEnabled: boolean) {
    // ./badvpn-tun2socks.exe \
    //   --tundev "tap0901:outline-tap0:10.0.85.2:10.0.85.0:255.255.255.0" \
    //   --netif-ipaddr 10.0.85.1 --netif-netmask 255.255.255.0 \
    //   --socks-server-addr 127.0.0.1:1081 \
    //   --socks5-udp --udp-relay-addr 127.0.0.1:1081 \
    //   --transparent-dns
    const args: string[] = [];
    args.push(
      '--tundev',
      isLinux
        ? TUN2SOCKS_TAP_DEVICE_NAME
        : `tap0901:${TUN2SOCKS_TAP_DEVICE_NAME}:${TUN2SOCKS_TAP_DEVICE_IP}:${TUN2SOCKS_TAP_DEVICE_NETWORK}:${TUN2SOCKS_VIRTUAL_ROUTER_NETMASK}`
    );
    args.push('--netif-ipaddr', TUN2SOCKS_VIRTUAL_ROUTER_IP);
    args.push('--netif-netmask', TUN2SOCKS_VIRTUAL_ROUTER_NETMASK);
    args.push('--socks-server-addr', `${this.proxyAddress}:${this.proxyPort}`);
    args.push('--transparent-dns');
    if (isUdpEnabled) {
      args.push('--socks5-udp');
      args.push('--udp-relay-addr', `${this.proxyAddress}:${this.proxyPort}`);
    }
    args.push('--loglevel', this.isInDebugMode ? 'info' : 'error');

    this.launch(args);
  }
}

// Resolves with true iff a response can be received from a semi-randomly-chosen website through the
// Shadowsocks proxy.
//
// This has the same function as ShadowsocksConnectivity.validateServerCredentials in
// cordova-plugin-outline.
function validateServerCredentials(proxyAddress: string, proxyIp: number) {
  return new Promise<void>((fulfill, reject) => {
    const testDomain = CREDENTIALS_TEST_DOMAINS[Math.floor(Math.random() * CREDENTIALS_TEST_DOMAINS.length)];
    socks.createConnection(
      {
        proxy: {ipaddress: proxyAddress, port: proxyIp, type: 5},
        target: {host: testDomain, port: 80},
      },
      (e, socket) => {
        if (e) {
          reject(new errors.InvalidServerCredentials(`could not connect to remote test website: ${e.message}`));
          return;
        }

        socket.write(`HEAD / HTTP/1.1\r\nHost: ${testDomain}\r\n\r\n`);

        socket.on('data', data => {
          if (data.toString().startsWith('HTTP/1.1')) {
            socket.end();
            fulfill();
          } else {
            socket.end();
            reject(new errors.InvalidServerCredentials(`unexpected response from remote test website`));
          }
        });

        socket.on('close', () => {
          reject(new errors.InvalidServerCredentials(`could not connect to remote test website`));
        });

        // Sockets must be resumed before any data will come in, as they are paused right before
        // this callback is fired.
        socket.resume();
      }
    );
  });
}

// DNS request to google.com.
const DNS_REQUEST = Buffer.from([
  0,
  0, // [0-1]   query ID
  1,
  0, // [2-3]   flags; byte[2] = 1 for recursion desired (RD).
  0,
  1, // [4-5]   QDCOUNT (number of queries)
  0,
  0, // [6-7]   ANCOUNT (number of answers)
  0,
  0, // [8-9]   NSCOUNT (number of name server records)
  0,
  0, // [10-11] ARCOUNT (number of additional records)
  6,
  103,
  111,
  111,
  103,
  108,
  101, // google
  3,
  99,
  111,
  109, // com
  0, // null terminator of FQDN (root TLD)
  0,
  1, // QTYPE, set to A
  0,
  1, // QCLASS, set to 1 = IN (Internet)
]);

// Verifies that the remote server has enabled UDP forwarding by sending a DNS request through it.
function checkUdpForwardingEnabled(proxyAddress: string, proxyIp: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    socks.createConnection(
      {
        proxy: {ipaddress: proxyAddress, port: proxyIp, type: 5, command: 'associate'},
        target: {host: '0.0.0.0', port: 0}, // Specify the actual target once we get a response.
      },
      (err, socket, info) => {
        if (err) {
          reject(new errors.RemoteUdpForwardingDisabled(`could not connect to local proxy`));
          return;
        }
        const packet = socks.createUDPFrame({host: '1.1.1.1', port: 53}, DNS_REQUEST);
        const udpSocket = dgram.createSocket('udp4');

        udpSocket.on('error', () => {
          reject(new errors.RemoteUdpForwardingDisabled('UDP socket failure'));
        });

        udpSocket.on('message', () => {
          stopUdp();
          resolve(true);
        });

        // Retry sending the query every second.
        // TODO: logging here is a bit verbose
        const intervalId = setInterval(() => {
          try {
            udpSocket.send(packet, info.port, info.host, err => {
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
          resolve(false);
        }, UDP_FORWARDING_TEST_TIMEOUT_MS);
      }
    );
  });
}
