import * as os from 'os';
import * as path from 'path';

const isWindows = os.platform() === 'win32';
const isLinux = os.platform() === 'linux';

// The returned path must be kept in sync with:
//  - the destination path for the binaries in build_action.sh
//  - the value specified for --config.asarUnpack in package_action.sh
export function pathToEmbeddedBinary(basename: string) {
  return path.join(
      __dirname.replace('app.asar', 'app.asar.unpacked'), 'bin', os.platform(),
      `${basename}` + (isWindows ? '.exe' : ''));
}
