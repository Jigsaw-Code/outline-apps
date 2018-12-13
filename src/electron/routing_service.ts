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
import * as os from 'os';
import * as path from 'path';
import * as sudo from 'sudo-prompt';

import * as errors from '../www/model/errors';
import {getServiceStartCommand} from './util';

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
  GET_DEVICE_NAME = 'getDeviceName',
  STATUS_CHANGED = 'statusChanged'
}

enum RoutingServiceStatusCode {
  SUCCESS = 0,
  GENERIC_FAILURE = 1,
  UNSUPPORTED_ROUTING_TABLE = 2
}

// Define the error type thrown by the net module.
interface NetError extends Error {
  code?: string|number;
  errno?: string;
  syscall?: string;
  address?: string;
}

// Abstracts IPC with OutlineService in order to configure routing.
export class RoutingService {
  private ipcConnection: net.Socket;

  // Asks OutlineService to configure all traffic, except that bound for the proxy server,
  // to route via routerIp.
  configureRouting(
      routerIp: string, proxyIp: string, onStatusChange: (status: ConnectionStatus) => void,
      isAutoConnect = false): Promise<string> {
    return this.sendRequest(
        {
          action: RoutingServiceAction.CONFIGURE_ROUTING,
          parameters: {proxyIp, routerIp, isAutoConnect}
        },
        true, onStatusChange);
  }

  // Restores the default system routes.
  resetRouting(): Promise<string> {
    try {
      this.ipcConnection.removeAllListeners();
    } catch (e) {
      // Ignore, the service may have disconnected the pipe.
    }
    return this.sendRequest({action: RoutingServiceAction.RESET_ROUTING, parameters: {}});
  }

  // Returns the name of the device.
  getDeviceName(): Promise<string> {
    // This is used when we read tun device name from the daemon and the value
    // comes in returnValue in the json.
    return this.sendRequest({action: RoutingServiceAction.GET_DEVICE_NAME, parameters: {}})
        .then((json) => {
          return JSON.parse(json).returnValue;
        });
  }

  // Helper method to perform IPC with the Windows Service. Prompts the user for admin permissions
  // to start the service, in the event that it is not running.
  private sendRequest(
      request: RoutingServiceRequest, retry = true,
      onStatusChange?: (status: ConnectionStatus) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.ipcConnection || this.ipcConnection.destroyed) {
        this.ipcConnection = net.createConnection(SERVICE_NAME, () => {
          console.log('Pipe connected');
          try {
            this.writeRequest(request);
          } catch (e) {
            reject(e);
          }
        });
      } else {
        // We already have a connection, write the request.
        try {
          this.writeRequest(request);
        } catch (e) {
          reject(e);
        }
      }
      this.ipcConnection.once('error', (e: NetError) => {
        if (retry) {
          console.info(`bouncing OutlineService (${e.errno})`);
          sudo.exec(getServiceStartCommand(), {name: 'Outline'}, (sudoError, stdout, stderr) => {
            if (sudoError) {
              // Yes, this seems to be the only way to tell.
              if ((typeof sudoError === 'string') &&
                  sudoError.toLowerCase().indexOf('did not grant permission') >= 0) {
                return reject(new errors.NoAdminPermissions());
              } else {
                // It's unclear what type sudoError is because it has no message
                // field. toString() seems to work in most cases, so use that -
                // anything else will eventually show up in Sentry.
                return reject(new errors.SystemConfigurationException(sudoError.toString()));
              }
            }
            console.info(`ran install_windows_service.bat (stdout: ${stdout}, stderr: ${stderr})`);
            this.sendRequest(request, false).then(resolve, reject);
          });
          return;
        } else {
          reject(new Error(`Routing Daemon/Service is not running.`));
        }
        // OutlineService could not be (re-)started.
        reject(new errors.SystemConfigurationException(
            `Received error from service connection: ${e.message}`));
      });

      this.ipcConnection.on('data', (data) => {
        if (data) {
          try {
            const response: RoutingServiceResponse = JSON.parse(data.toString());
            if (onStatusChange && response.action === RoutingServiceAction.STATUS_CHANGED) {
              onStatusChange(response.connectionStatus);
              return response;
            }
            if (response.action !== request.action) {
              // Don't resolve yet; we got a status change response. This can happen when connecting
              // to a new server without previously disconnecting.
              return;
            }
            console.log(`Got data from pipe for action: ${response.action}`);
            if (response.statusCode !== RoutingServiceStatusCode.SUCCESS) {
              const msg = `OutlineService says: ${response.errorMessage}`;
              reject(
                  response.statusCode === RoutingServiceStatusCode.UNSUPPORTED_ROUTING_TABLE ?
                      new errors.UnsupportedRoutingTable(msg) :
                      new errors.ConfigureSystemProxyFailure(msg));
            }
            return resolve(data.toString());
          } catch (e) {
            reject(new Error(`Failed to deserialize service response: ${e.message}`));
          }
        } else {
          reject(new Error('Failed to receive data form routing service'));
        }
      });
    });
  }

  // Helper method to write a RoutingServiceRequest to the connected pipe.
  private writeRequest(request: RoutingServiceRequest): void {
    try {
      this.ipcConnection.write(JSON.stringify(request));
    } catch (e) {
      throw new Error(`Failed to write request: ${e.message}`);
    }
  }
}
