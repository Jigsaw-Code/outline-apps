import { spawn, ExitCodeError } from '@malept/cross-spawn-promise';
import * as fs from 'fs-extra';
import * as path from 'path';
const MACHO_PREFIX = 'Mach-O ';
export var AppFileType;
(function (AppFileType) {
    AppFileType[AppFileType["MACHO"] = 0] = "MACHO";
    AppFileType[AppFileType["PLAIN"] = 1] = "PLAIN";
    AppFileType[AppFileType["INFO_PLIST"] = 2] = "INFO_PLIST";
    AppFileType[AppFileType["SNAPSHOT"] = 3] = "SNAPSHOT";
    AppFileType[AppFileType["APP_CODE"] = 4] = "APP_CODE";
})(AppFileType || (AppFileType = {}));
/**
 *
 * @param appPath Path to the application
 */
export const getAllAppFiles = async (appPath) => {
    const files = [];
    const visited = new Set();
    const traverse = async (p) => {
        p = await fs.realpath(p);
        if (visited.has(p))
            return;
        visited.add(p);
        const info = await fs.stat(p);
        if (info.isSymbolicLink())
            return;
        if (info.isFile()) {
            let fileType = AppFileType.PLAIN;
            var fileOutput = '';
            try {
                fileOutput = await spawn('file', ['--brief', '--no-pad', p]);
            }
            catch (e) {
                if (e instanceof ExitCodeError) {
                    /* silently accept error codes from "file" */
                }
                else {
                    throw e;
                }
            }
            if (p.includes('app.asar')) {
                fileType = AppFileType.APP_CODE;
            }
            else if (fileOutput.startsWith(MACHO_PREFIX)) {
                fileType = AppFileType.MACHO;
            }
            else if (p.endsWith('.bin')) {
                fileType = AppFileType.SNAPSHOT;
            }
            else if (path.basename(p) === 'Info.plist') {
                fileType = AppFileType.INFO_PLIST;
            }
            files.push({
                relativePath: path.relative(appPath, p),
                type: fileType,
            });
        }
        if (info.isDirectory()) {
            for (const child of await fs.readdir(p)) {
                await traverse(path.resolve(p, child));
            }
        }
    };
    await traverse(appPath);
    return files;
};
//# sourceMappingURL=file-utils.js.map