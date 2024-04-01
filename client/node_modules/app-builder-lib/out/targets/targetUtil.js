"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWindowsInstallationAppPackageName = exports.getWindowsInstallationDirName = exports.createStageDirPath = exports.createStageDir = exports.StageDir = void 0;
const path = require("path");
const builder_util_1 = require("builder-util");
const fs = require("fs/promises");
class StageDir {
    constructor(dir) {
        this.dir = dir;
    }
    getTempFile(name) {
        return this.dir + path.sep + name;
    }
    cleanup() {
        if (!builder_util_1.debug.enabled || process.env.ELECTRON_BUILDER_REMOVE_STAGE_EVEN_IF_DEBUG === "true") {
            return fs.rm(this.dir, { recursive: true, force: true });
        }
        return Promise.resolve();
    }
    toString() {
        return this.dir;
    }
}
exports.StageDir = StageDir;
async function createStageDir(target, packager, arch) {
    return new StageDir(await createStageDirPath(target, packager, arch));
}
exports.createStageDir = createStageDir;
async function createStageDirPath(target, packager, arch) {
    const tempDir = packager.info.stageDirPathCustomizer(target, packager, arch);
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
}
exports.createStageDirPath = createStageDirPath;
// https://github.com/electron-userland/electron-builder/issues/3100
// https://github.com/electron-userland/electron-builder/commit/2539cfba20dc639128e75c5b786651b652bb4b78
function getWindowsInstallationDirName(appInfo, isTryToUseProductName) {
    return isTryToUseProductName && /^[-_+0-9a-zA-Z .]+$/.test(appInfo.productFilename) ? appInfo.productFilename : appInfo.sanitizedName;
}
exports.getWindowsInstallationDirName = getWindowsInstallationDirName;
// https://github.com/electron-userland/electron-builder/issues/6747
function getWindowsInstallationAppPackageName(appName) {
    return appName.replace(/\//g, "\\");
}
exports.getWindowsInstallationAppPackageName = getWindowsInstallationAppPackageName;
//# sourceMappingURL=targetUtil.js.map