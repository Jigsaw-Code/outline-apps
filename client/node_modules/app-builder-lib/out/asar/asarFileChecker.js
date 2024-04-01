"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkFileInArchive = void 0;
const fs_1 = require("builder-util/out/fs");
const asar_1 = require("./asar");
/** @internal */
async function checkFileInArchive(asarFile, relativeFile, messagePrefix) {
    function error(text) {
        return new Error(`${messagePrefix} "${relativeFile}" in the "${asarFile}" ${text}`);
    }
    let fs;
    try {
        fs = await asar_1.readAsar(asarFile);
    }
    catch (e) {
        throw error(`is corrupted: ${e}`);
    }
    let stat;
    try {
        stat = fs.getFile(relativeFile);
    }
    catch (e) {
        const fileStat = await fs_1.statOrNull(asarFile);
        if (fileStat == null) {
            throw error(`does not exist. Seems like a wrong configuration.`);
        }
        // asar throws error on access to undefined object (info.link)
        stat = null;
    }
    if (stat == null) {
        throw error(`does not exist. Seems like a wrong configuration.`);
    }
    if (stat.size === 0) {
        throw error(`is corrupted: size 0`);
    }
}
exports.checkFileInArchive = checkFileInArchive;
//# sourceMappingURL=asarFileChecker.js.map