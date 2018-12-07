import {app} from 'electron';
import * as fs from 'fs';
import * as fsextra from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

const isWindows = os.platform() === 'win32';
const isLinux = os.platform() === 'linux';

const LINUX_DAEMON_FILENAME = 'OutlineProxyController';
const LINUX_DAEMON_SYSTEMD_SERVICE_FILENAME = 'outline_proxy_controller.service';
const LINUX_INSTALLER_FILENAME = 'install_linux_service.sh';

const LINUX_TEMP_FOLDER = fs.mkdtempSync('/tmp/');

export function pathToEmbeddedBinaryFolder() {
  return path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'bin', os.platform());
}

export function pathToServiceInstallationScript() {}

// The returned path must be kept in sync with:
//  - the destination path for the binaries in build_action.sh
//  - the value specified for --config.asarUnpack in package_action.sh
export function pathToEmbeddedBinary(basename: string) {
  return path.join(
      pathToEmbeddedBinaryFolder(),
      //      __dirname.replace('app.asar', 'app.asar.unpacked'), 'bin', os.platform(),
      `${basename}` + (isWindows ? '.exe' : ''));
}

export function getServiceStartCommand(): string {
  if (isWindows) {
    return `"${
        path.join(
            app.getAppPath().includes('app.asar') ? path.dirname(app.getPath('exe')) :
                                                    app.getAppPath(),
            'install_' + os.platform() + '_service.' + (isWindows ? 'bat' : 'sh'))}"`;

  } else if (isLinux) {
    copyServiceFilesToTempFolder();

    return path.join(LINUX_TEMP_FOLDER, LINUX_INSTALLER_FILENAME);
  } else {
    throw new Error('Unsupported Operating System');
  }
}

// In some linux distro (tested on Debian) root is  disallowed to access the appImage mounted folder
// so we need to copy these files out of there so root can copy them in privilage folders
export function copyServiceFilesToTempFolder() {
  // create a tmp folder which root can access
  try {
    fs.mkdirSync(LINUX_TEMP_FOLDER);
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }

  const binDestination = pathToEmbeddedBinaryFolder();

  const serviceRelatedFiles =
      [LINUX_DAEMON_FILENAME, LINUX_DAEMON_SYSTEMD_SERVICE_FILENAME, LINUX_INSTALLER_FILENAME];
  serviceRelatedFiles.forEach((currentFile) => {
    const sourceDaemonFile = pathToEmbeddedBinary(currentFile);
    const destDaemonFile = path.join(LINUX_TEMP_FOLDER, currentFile);

    try {
      fsextra.copySync(sourceDaemonFile, destDaemonFile, {overwrite: true});
    } catch (err) {
      throw err;
    }
  });
}
