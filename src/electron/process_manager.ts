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

import {ChildProcess, spawn} from 'child_process';
import {platform} from 'os';

import {checkUdpForwardingEnabled, waitForListen} from './connectivity';
import {RoutingService} from './routing_service';
import {pathToEmbeddedBinary} from './util';

const isLinux = platform() === 'linux';

export const PROXY_ADDRESS = '127.0.0.1';
export const PROXY_PORT = 1081;

const TUN2SOCKS_TAP_DEVICE_NAME = isLinux ? 'outline-tun0' : 'outline-tap0';
const TUN2SOCKS_TAP_DEVICE_IP = '10.0.85.2';
const TUN2SOCKS_VIRTUAL_ROUTER_IP = '10.0.85.1';
const TUN2SOCKS_TAP_DEVICE_NETWORK = '10.0.85.0';
const TUN2SOCKS_VIRTUAL_ROUTER_NETMASK = '255.255.255.0';

// Coordinates routing and helper processes to establish a full-system VPN.
// Follows the Mediator pattern.
//
// TODO: restart tun2socks when UDP support changes
export class ConnectionMediator {
  private tun2socks = new Tun2socks(PROXY_ADDRESS, PROXY_PORT);

  // TODO: getter?
  public readonly onceStopped: Promise<void>;

  static newInstance(config: cordova.plugins.outline.ServerConfig, isAutoConnect: boolean):
      Promise<ConnectionMediator> {
    return new Promise((F, R) => {
      // test whether UDP is available; this determines the flags passed to tun2socks.
      // to perform this test, ss-local must be up and running.
      const ssLocal = new SsLocal(PROXY_PORT);
      ssLocal.setExitListener(() => {
        R(new Error('ss-local exited during UDP check'));
      });
      ssLocal.start(config);

      waitForListen(PROXY_ADDRESS, PROXY_PORT)
          .then(() => {
            return checkUdpForwardingEnabled(PROXY_ADDRESS, PROXY_PORT);
          })
          .then((udpEnabled) => {
            console.log(`UDP support: ${udpEnabled}`);
            return RoutingService.getInstanceAndStart(config.host || '', isAutoConnect)
                .then((routing) => {
                  F(new ConnectionMediator(routing, ssLocal, udpEnabled));
                });
          })
          .catch((e) => {
            ssLocal.stop();
            R(e);
          });
    });
  }

  private constructor(
      private readonly routing: RoutingService, private readonly ssLocal: SsLocal,
      udpEnabled: boolean) {
    const exits = [
      this.routing.onceStopped.then(() => {
        console.log(`disconnected from routing service`);
      }),
      new Promise<void>((F) => {
        this.ssLocal.setExitListener(() => {
          console.log(`ss-local terminated`);
          F();
        });
      }),
      new Promise<void>((F) => {
        this.tun2socks.setExitListener(() => {
          console.log(`tun2socks terminated`);
          F();
        });
      })
    ];

    // if anything fails/exits, abandon ship.
    Promise.race(exits).then(this.stop.bind(this));

    // once they've *all* failed/exited, we're done.
    this.onceStopped = Promise.all(exits).then(() => {});

    // and go.
    this.tun2socks.start(udpEnabled);
  }

  // returns immediately; use onceStopped for notifications.
  stop() {
    this.routing.stop();
    this.ssLocal.stop();
    this.tun2socks.stop();
  }
}

class SingletonProcess {
  private process?: ChildProcess;

  constructor(private path: string) {}

  private exitListener?: () => void;

  setExitListener(newListener?: () => void): void {
    this.exitListener = newListener;
  }

  // Note that there is *no way* to tell whether a process was launched successfully: callers should
  // assume the process was launched successfully until they receive an exit message, which may
  // happen immediately after calling this function.
  protected startInternal(args: string[]) {
    if (this.process) {
      throw new Error('already running');
    }

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

    // Listen for both: error is failure to launch, exit may not be invoked in that case.
    this.process.on('error', onExit.bind((this)));
    this.process.on('exit', onExit.bind((this)));
  }

  stop() {
    if (this.process) {
      this.process.kill();
    }
  }
}

class SsLocal extends SingletonProcess {
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

    this.startInternal(args);
  }
}

// TODO: handle exits caused by suspend/resume?
class Tun2socks extends SingletonProcess {
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

    this.startInternal(args);
  }
}
