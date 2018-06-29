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

import * as net from 'net';
import * as sudo from 'sudo-prompt';
import {SentryLogger} from './sentry_logger';

const SERVICE_PIPE_NAME = 'OutlineServicePipe';
const SERVICE_PIPE_PATH = '\\\\.\\pipe\\';
const SERVICE_START_COMMAND = 'net start OutlineService';

const sentryLogger = new SentryLogger();

interface RoutingServiceRequest {
  action: string,
  parameters: {[parameter: string]: string}
}

interface RoutingServiceResponse {
  statusCode: number
}

export interface RoutingService {
  configureRouting(routerIp: string, proxyIp: string): Promise<boolean>;
  resetRouting(): Promise<boolean>;
}

enum RoutingServiceAction {
  CONFIGURE_ROUTING = 'configureRouting',
  RESET_ROUTING = 'resetRouting'
}

// Define the error type thrown by the net moudle.
interface NetError extends Error {
  code?: string|number,
  errno?: string,
  syscall?: string,
  address?: string
}

// Abstracts IPC with OutlineService in order to configure routing.
export class WindowsRoutingService implements RoutingService {
  private ipcConnection: net.Socket;

  // Configures all system routes, except `proxyIp`, to go through `routerIp`.
  // Disables IPv6 routing.s
  configureRouting(routerIp: string, proxyIp: string): Promise<boolean> {
    const request = {
      action: RoutingServiceAction.CONFIGURE_ROUTING,
      parameters: {
        proxyIp,
        routerIp,
      }
    };
    return this.sendRequest(request).then((response) => {
       return response.statusCode === 0;
    }).catch((e) => {
      const msg = `Failed to configure routing: ${e.message}`;
      sentryLogger.error(msg);
      return Promise.reject(new Error(msg));
    });
  }

  // Restores the default system routes.
  resetRouting(): Promise<boolean> {
    const request = {
      action: RoutingServiceAction.RESET_ROUTING,
      parameters: {}
    };
    return this.sendRequest(request).then((response) => {
      return response.statusCode === 0;
    }).catch((e) => {
      const msg = `Failed to reset routing: ${e.message}`;
      sentryLogger.error(msg);
      return Promise.reject(new Error(msg));
    });
  }

  // Helper method to perform IPC with the Windows Service. Prompts the user for admin permissions
  // to start the service, in the event that it is not running.
  private sendRequest(request: RoutingServiceRequest): Promise<RoutingServiceResponse> {
    return new Promise((resolve, reject) => {
      this.ipcConnection = net.createConnection(`${SERVICE_PIPE_PATH}${SERVICE_PIPE_NAME}`, () => {
        console.log('Pipe connected');
        try {
          const msg = JSON.stringify(request);
          this.ipcConnection.write(msg);
        } catch (e) {
          reject(new Error(`Failed to serialize JSON request: ${e.message}`));
        }
      });

      this.ipcConnection.on('error', (err) => {
        const netErr = err as NetError;
        if (netErr.errno === 'ENOENT') {
          sentryLogger.info(`Routing service not running. Attempting to start.`)
          // Prompt the user for admimn permissions to start the routing service.
          sudo.exec(SERVICE_START_COMMAND, {name: 'Outline'}, (sudoError, stdout, stderr) => {
            if (sudoError) {
              if (/service has already been started|net helpmsg 2182/i.test(sudoError.message)) {
                // Wait for the service to start before sending the request.
                sentryLogger.info('Waiting for routing servcie to come up...');
                return setTimeout(() => {
                  this.sendRequest(request).then(resolve, reject);
                }, 2000);
              }
              return reject(new Error(`Failed to start routing service: ${sudoError}`));
            }
            this.sendRequest(request).then(resolve, reject); // Retry now that the service is running
          });
          return;
        }
        reject(new Error(`Received error from service connection: ${netErr.message}`));
      });

      this.ipcConnection.on('data', (data) => {
        console.log('Got data from pipe');
        if (data) {
          try {
            const response = JSON.parse(data.toString());
            resolve(response);
          } catch (e) {
            reject(new Error(`Failed to deserialize service response: ${e.message}`));
          }
        } else {
          reject(new Error('Failed to receive data form routing service'));
        }
        try {
          this.ipcConnection.destroy();
        } catch(e) {
          // Don't reject, the service may have disconnected the pipe already.
        }
      });
    });
  }
}
