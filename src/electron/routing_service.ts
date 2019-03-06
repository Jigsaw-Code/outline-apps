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

import {createConnection, Socket} from 'net';
import * as os from 'os';

import * as errors from '../www/model/errors';

const SERVICE_NAME =
    os.platform() === 'win32' ? '\\\\.\\pipe\\OutlineServicePipe' : '/var/run/outline_controller';

interface RoutingServiceRequest {
  action: string;
  parameters: {[parameter: string]: string|boolean};
}

interface RoutingServiceResponse {
  action: RoutingServiceAction;  // Matches RoutingServiceRequest.action
  statusCode: RoutingServiceStatusCode;
  errorMessage?: string;
  connectionStatus: ConnectionStatus;
}

enum RoutingServiceAction {
  CONFIGURE_ROUTING = 'configureRouting',
  RESET_ROUTING = 'resetRouting',
  STATUS_CHANGED = 'statusChanged'
}

enum RoutingServiceStatusCode {
  SUCCESS = 0,
  GENERIC_FAILURE = 1,
  UNSUPPORTED_ROUTING_TABLE = 2
}

// Communicates with the Outline routing daemon via a Unix socket.
//
// Works on both Windows and Linux.
//
// Due to the complexity of emulating a Promise-like interface (currently expected by the rest of
// the system) on top of a pipe-like connection to the service, *multiple, concurrent calls to
// start() or stop() are not recommended*. For this reason - and because on Windows multiple clients
// cannot connect to the pipe concurrently - this class connects to the service for *as short a time
// as possible*: CONFIGURE_ROUTING always uses a *new* connection to the service and the socket is
// always closed after receiving a RESET_ROUTING response.
//
// Run these commands to start/stop the service:
//  - Linux:
//    sudo systemctl start outline_proxy_controller.service
//    sudo systemctl stop outline_proxy_controller.service
//  - Windows:
//    net stop OutlineService
//    net start OutlineService
//
// TODO: network change notifications
// TODO: offer to install the service (linux)
export class RoutingService {
  private fulfillStopped!: () => void;

  // TODO: getter?
  public readonly onceStopped = new Promise<void>((F) => {
    this.fulfillStopped = F;
  });

  static getInstanceAndStart(proxyAddress: string, isAutoConnect: boolean):
      Promise<RoutingService> {
    return new Promise((F, R) => {
      const socket = createConnection(SERVICE_NAME, () => {
                       socket.once('data', (data) => {
                         const message: RoutingServiceResponse = JSON.parse(data.toString());
                         if (message.action !== RoutingServiceAction.CONFIGURE_ROUTING ||
                             message.statusCode !== RoutingServiceStatusCode.SUCCESS) {
                           // TODO: concrete error
                           R(new Error(message.errorMessage));
                           socket.end();
                           return;
                         }

                         F(new RoutingService(socket));
                       });

                       socket.write(JSON.stringify({
                         action: RoutingServiceAction.CONFIGURE_ROUTING,
                         parameters: {'proxyIp': proxyAddress, 'isAutoConnect': isAutoConnect}
                       }));
                     }).once('error', (e) => {
        // TODO: concrete error
        R(new Error(`could not connect: ${e.message}`));
      });
    });
  }

  private constructor(private readonly socket: Socket) {
    socket.on('data', (data) => {
      const message: RoutingServiceResponse = JSON.parse(data.toString());
      switch (message.action) {
        case RoutingServiceAction.STATUS_CHANGED:
          console.log(`ROUTING CHANGE: ${data.toString()}`);
          break;
        case RoutingServiceAction.RESET_ROUTING:
          // TODO: examine statusCode
          socket.end();
          break;
        default:
          console.error(`unexpected message from background service: ${data.toString()}`);
      }
    });

    // Invoked as both a result of calling end() and service/socket failure.
    socket.once('close', () => {
      socket.removeAllListeners();
      this.fulfillStopped();
    });
  }

  // returns immediately; use onceStopped for notifications.
  stop() {
    this.socket.write(JSON.stringify({action: RoutingServiceAction.RESET_ROUTING, parameters: {}}));
  }
}
