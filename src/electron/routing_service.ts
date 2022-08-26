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

import * as child_process from 'node:child_process';
import * as fsextra from 'fs-extra';
import {createConnection, Socket} from 'net';
import {platform} from 'os';
import * as path from 'path';
import * as sudo from 'sudo-prompt';
import {promisify} from 'node:util';

import {getAppPath, getCurrentRunningBinaryPath} from '../infrastructure/electron/app_paths';
import {TunnelStatus} from '../www/app/tunnel';
import {ErrorCode, SystemConfigurationException} from '../www/model/errors';

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

/**
 * Execute arbitary shell `command` as root.
 * @param command Any valid shell command(s).
 */
function executeCommandAsRoot(command: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    sudo.exec(command, {name: 'Outline'}, (sudoError, stdout, stderr) => {
      console.info(stdout);
      console.error(stderr);
      // This error message is an un-exported constant defined here:
      //   - https://github.com/jorangreef/sudo-prompt/blob/v9.2.1/index.js#L670
      const PERMISSION_DENIED = 'did not grant permission';
      if (sudoError) {
        if (sudoError.message?.includes(PERMISSION_DENIED)) {
          console.error('user rejected to run command as root: ', sudoError);
          reject(ErrorCode.NO_ADMIN_PERMISSIONS);
        } else {
          console.error('command is running as root but failed: ', sudoError);
          reject(ErrorCode.UNEXPECTED);
        }
      } else {
        resolve();
      }
    });
  });
}

/**
 * Execute arbitary shell `command` as a new child process.
 * @param command Any valid shell command(s).
 * @returns The standard output of the `command`.
 */
async function executeShellCommand(command: string): Promise<string> {
  const exec = promisify(child_process.exec);
  const {stdout, stderr} = await exec(command);
  console.info(stdout);
  console.error(stderr);
  return stdout;
}

/**
 * By default, root user is not able to connect to X Server, but it is required
 * if we need to run Outline-Client (even in CLI mode) under root. This function let
 * the caller specify whether root user is allowed to access X server. It will also
 * return whether root is allowed before (so we can revert the change we made).
 */
async function configureRootXServerAccess(allowRootAccess: boolean): Promise<boolean> {
  const ROOT_USER_ID = 'si:localuser:root';
  const prevOut = (await executeShellCommand('xhost')) ?? '';
  await executeShellCommand(`xhost ${allowRootAccess ? '+' : '-'}${ROOT_USER_ID}`);
  return prevOut.toLowerCase().includes(ROOT_USER_ID);
}

function doInstallWindowsRoutingServices(): Promise<void> {
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

/**
 * The actual steps to install a Linux Outline service. The caller should already
 * granted the admin permission to the process before calling this method.
 */
export async function doInstallLinuxRoutingServices(): Promise<void> {
  if (!isLinux) {
    throw new Error('please call this method in Linux');
  }

  console.log('installing Outline service...');
  const SERVICE_SOURCE_FOLDER = path.resolve(getAppPath(), 'tools/outline_proxy_controller/dist');
  const SERVICE_BINARY = 'OutlineProxyController';
  const SERVICE_BINARY_TARGET_FOLDER = '/usr/local/sbin';
  const SERVICE_DEFINITION = 'outline_proxy_controller.service';
  const SERVICE_DEFINITION_TARGET_FOLDER = '/etc/systemd/system';

  const binSource = path.join(SERVICE_SOURCE_FOLDER, SERVICE_BINARY);
  const binTarget = path.join(SERVICE_BINARY_TARGET_FOLDER, SERVICE_BINARY);
  console.log(`copying Outline service binary from "${binSource}" to "${binTarget}"...`);
  await fsextra.copy(binSource, binTarget, {overwrite: true});
  await fsextra.chmod(binTarget, 0o755);
  console.info('successfully installed Outline service binary');

  const svcSource = path.join(SERVICE_SOURCE_FOLDER, SERVICE_DEFINITION);
  const svcTarget = path.join(SERVICE_DEFINITION_TARGET_FOLDER, SERVICE_DEFINITION);
  console.log(`copying Outline service definition from "${svcSource}" to "${svcTarget}"...`);
  await fsextra.copy(svcSource, svcTarget, {overwrite: true});
  console.info('successfully installed Outline service definition');

  console.log('registering Outline service to systemctl...');
  await executeShellCommand('systemctl daemon-reload');
  await executeShellCommand(`systemctl enable ${SERVICE_DEFINITION}`);
  await executeShellCommand(`systemctl restart ${SERVICE_DEFINITION}`);
  console.info('Outline service successfully registered');

  // Because the .service file specifies Type=simple, the installation script exits immediately.
  // Sleep for a couple of seconds before exiting.
  await new Promise(r => setTimeout(r, 2000));
  console.info('Outline service successfully installed');
}

export async function installRoutingServices(): Promise<void> {
  console.info('installing outline routing service...');
  if (isWindows) {
    await doInstallWindowsRoutingServices();
  } else if (isLinux) {
    // Run `sudo ./Outline-Client.AppImage --install` to install the service
    //   * `--headless` is required by chromium:
    //       'ERROR:ozone_platform_x11.cc(247)] Missing X server or $DISPLAY'
    //   * `$DISPLAY` and `xhost +si:localuser:root` is required by electron:
    //       'Gtk-WARNING **: 18:24:17.308: cannot open display: '
    //   * `--no-sandbox` is required for root due to chrome issue: https://crbug.com/638180
    //   * gpu related options are used to prevent any potential GPU permission issues
    const oldRootXServerAccess = await configureRootXServerAccess(true);
    try {
      await executeCommandAsRoot(
        `DISPLAY=${process.env.DISPLAY} ` +
          `${getCurrentRunningBinaryPath()} --install --headless --no-sandbox --disable-gpu --disable-gpu-sandbox`
      );
    } finally {
      await configureRootXServerAccess(oldRootXServerAccess);
    }
  } else {
    throw new Error('unsupported os');
  }
  console.info('outline routing service installed successfully');
}

//#endregion routing service installation
