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

import * as fsextra from 'fs-extra';
import {createConnection, Socket} from 'net';
import {platform} from 'os';
import * as path from 'path';
import * as sudo from 'sudo-prompt';

import {TunnelStatus} from '../www/app/tunnel';
import {NoAdminPermissions, SystemConfigurationException, toErrorCode} from '../www/model/errors';
import {getAppPath} from './util';

const isLinux = platform() === 'linux';
const isWindows = platform() === 'win32';
const SERVICE_NAME = isWindows ? '\\\\.\\pipe\\OutlineServicePipe' : '/var/run/outline_controller';

interface RoutingServiceRequest {
  action: string;
  parameters: {[parameter: string]: string | boolean};
}

interface RoutingServiceResponse {
  action: RoutingServiceAction; // Matches RoutingServiceRequest.action
  statusCode: RoutingServiceStatusCode;
  errorMessage?: string;
  connectionStatus: TunnelStatus;
}

enum RoutingServiceAction {
  CONFIGURE_ROUTING = 'configureRouting',
  RESET_ROUTING = 'resetRouting',
  STATUS_CHANGED = 'statusChanged',
}

enum RoutingServiceStatusCode {
  SUCCESS = 0,
  GENERIC_FAILURE = 1,
  UNSUPPORTED_ROUTING_TABLE = 2,
}

// Communicates with the Outline routing daemon via a Unix socket.
//
// A minimal life-cycle is supported:
//  - CONFIGURE_ROUTING is *always* the first message sent on the pipe.
//  - The only subsequent supported operation is RESET_ROUTING.
//  - In the meantime, the client may receive zero or more STATUS_CHANGED events.
//
// That's it! This helps us connect to the service for *as short a time as possible* which is
// important when trying to implement a Promise-like interface over what is essentially a pipe *and*
// on Windows where only one client may be connected to the service at any given time.
//
// To test:
//  - Linux: systemctl start|stop outline_proxy_controller.service
//  - Windows: net start|stop OutlineService
export class RoutingDaemon {
  private socket: Socket | undefined;

  private stopping = false;

  private fulfillDisconnect!: () => void;

  private disconnected = new Promise<void>(F => {
    this.fulfillDisconnect = F;
  });

  private networkChangeListener?: (status: TunnelStatus) => void;

  constructor(private proxyAddress: string, private isAutoConnect: boolean) {}

  // Fulfills once a connection is established with the routing daemon *and* it has successfully
  // configured the system's routing table.
  async start() {
    return new Promise<void>((fulfill, reject) => {
      const newSocket = (this.socket = createConnection(SERVICE_NAME, () => {
        newSocket.removeListener('error', initialErrorHandler);
        const cleanup = () => {
          newSocket.removeAllListeners();
          this.socket = null;
          this.fulfillDisconnect();
        };
        newSocket.once('close', cleanup);
        newSocket.once('error', cleanup);

        newSocket.once('data', data => {
          const message = this.parseRoutingServiceResponse(data);
          if (
            !message ||
            message.action !== RoutingServiceAction.CONFIGURE_ROUTING ||
            message.statusCode !== RoutingServiceStatusCode.SUCCESS
          ) {
            // NOTE: This will rarely occur because the connectivity tests
            //       performed when the user clicks "CONNECT" should detect when
            //       the system is offline and that, currently, is pretty much
            //       the only time the routing service will fail.
            reject(new Error(message ? message.errorMessage : 'empty routing service response'));
            newSocket.end();
            return;
          }

          newSocket.on('data', this.dataHandler.bind(this));

          // Potential race condition: this routing daemon might already be stopped by the tunnel
          // when one of the dependencies (ss-local/tun2socks) exited
          // TODO(junyi): better handling this case in the next installation logic fix
          if (this.stopping) {
            cleanup();
            newSocket.destroy();
            reject(new SystemConfigurationException('routing daemon service stopped before started'));
          } else {
            fulfill();
          }
        });

        newSocket.write(
          JSON.stringify({
            action: RoutingServiceAction.CONFIGURE_ROUTING,
            parameters: {proxyIp: this.proxyAddress, isAutoConnect: this.isAutoConnect},
          } as RoutingServiceRequest)
        );
      }));

      const initialErrorHandler = () => {
        this.socket = null;
        reject(new SystemConfigurationException('routing daemon is not running'));
      };
      newSocket.once('error', initialErrorHandler);
    });
  }

  private dataHandler(data: Buffer) {
    const message = this.parseRoutingServiceResponse(data);
    if (!message) {
      return;
    }
    switch (message.action) {
      case RoutingServiceAction.STATUS_CHANGED:
        if (this.networkChangeListener) {
          this.networkChangeListener(message.connectionStatus);
        }
        break;
      case RoutingServiceAction.RESET_ROUTING:
        // TODO: examine statusCode
        if (this.socket) {
          this.socket.end();
        }
        break;
      default:
        console.error(`unexpected message from background service: ${data.toString()}`);
    }
  }

  // Parses JSON `data` as a `RoutingServiceResponse`. Logs the error and returns undefined on
  // failure.
  private parseRoutingServiceResponse(data: Buffer): RoutingServiceResponse | undefined {
    if (!data) {
      console.error('received empty response from routing service');
      return undefined;
    }
    let response: RoutingServiceResponse | undefined = undefined;
    try {
      response = JSON.parse(data.toString());
    } catch (error) {
      console.error(`failed to parse routing service response: ${data.toString()}`);
    }
    return response;
  }

  private async writeReset() {
    return new Promise<void>((resolve, reject) => {
      const written = this.socket.write(
        JSON.stringify({action: RoutingServiceAction.RESET_ROUTING, parameters: {}} as RoutingServiceRequest),
        err => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
      if (!written) {
        reject(new Error('Write failed'));
      }
    });
  }

  // stop() resolves when the stop command has been sent.
  // Use #onceDisconnected to be notified when the connection terminates.
  async stop() {
    if (!this.socket) {
      // Never started.
      this.fulfillDisconnect();
      return;
    }
    if (this.stopping) {
      // Already stopped.
      return;
    }
    this.stopping = true;

    return this.writeReset();
  }

  public get onceDisconnected() {
    return this.disconnected;
  }

  public set onNetworkChange(newListener: ((status: TunnelStatus) => void) | undefined) {
    this.networkChangeListener = newListener;
  }
}

//#region routing service installation

function executeCommandAsRoot(command: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    sudo.exec(command, {name: 'Outline'}, sudoError => {
      if (sudoError) {
        // NOTE: The script could have terminated with an error - see the comment in
        //       sudo-prompt's typings definition.
        console.error('failed to execute command as root: ', sudoError);
        reject(toErrorCode(new NoAdminPermissions(sudoError.message)));
      } else {
        resolve();
      }
    });
  });
}

function installWindowsRoutingServices(): Promise<void> {
  const WINDOWS_INSTALLER_FILENAME = 'install_windows_service.bat';

  // Locating the script is tricky: when packaged, this basically boils down to:
  //   c:\program files\Outline\
  // but during development:
  //   build/windows
  //
  // Surrounding quotes important, consider "c:\program files"!
  const script = `"${path.join(getAppPath(), WINDOWS_INSTALLER_FILENAME)}"`;
  return executeCommandAsRoot(script);
}

async function installLinuxRoutingServices(): Promise<void> {
  const OUTLINE_PROXY_CONTROLLER_PATH = path.join('tools', 'outline_proxy_controller', 'dist');
  const LINUX_INSTALLER_FILENAME = 'install_linux_service.sh';
  // [InstallationFileName, isExecutable]...
  const LINUX_SERVICE_FILE_NAMES: Array<[string, boolean]> = [
    [LINUX_INSTALLER_FILENAME, true],
    ['OutlineProxyController', true],
    ['outline_proxy_controller.service', false],
  ];

  // These Linux service files are located in a mounted folder of the AppImage, typically
  // located at /tmp/.mount_Outlinxxxxxx/resources/. These files can only be acceeded by
  // the user who launched Outline.AppImage, so even root cannot access the files or folders.
  // Therefore we have to copy these files to a normal temporary folder, and execute them
  // as root.
  //
  // Also, we are copying individual files instead of the entire folder because they are in
  // electron's "asar" archive (which is returned by getAppPath). Electron tries to inject
  // some logic to node's fs API and make sure the caller can access files in the archive.
  // However directories are not supported.
  //
  // References:
  // - https://github.com/AppImage/AppImageKit/issues/146
  // - https://xwartz.gitbooks.io/electron-gitbook/content/en/tutorial/application-packaging.html
  const tmp = await fsextra.mkdtemp('/tmp/');
  const srcFolderPath = path.join(getAppPath(), OUTLINE_PROXY_CONTROLLER_PATH);

  console.log(`copying service installation files to ${tmp}`);
  for (const [filename, executable] of LINUX_SERVICE_FILE_NAMES) {
    const dest = path.join(tmp, filename);
    await fsextra.copy(path.join(srcFolderPath, filename), dest, {overwrite: true});
    if (executable) {
      await fsextra.chmod(dest, 0o755);
    }
  }
  console.log(`all service installation files copied to ${tmp} successfully`);

  await executeCommandAsRoot(path.join(tmp, LINUX_INSTALLER_FILENAME));
}

export async function installRoutingServices(): Promise<void> {
  console.info('installing outline routing service...');
  if (isWindows) {
    await installWindowsRoutingServices();
  } else if (isLinux) {
    await installLinuxRoutingServices();
  } else {
    throw new Error('unsupported os');
  }
  console.info('outline routing service installed successfully');
}

//#endregion routing service installation
