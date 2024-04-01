"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildForge = void 0;
const path = require("path");
const index_1 = require("./index");
function buildForge(forgeOptions, options) {
    const appDir = forgeOptions.dir;
    return index_1.build({
        prepackaged: appDir,
        config: {
            directories: {
                // https://github.com/electron-userland/electron-forge/blob/master/src/makers/generic/zip.js
                output: path.resolve(appDir, "..", "make"),
            },
        },
        ...options,
    });
}
exports.buildForge = buildForge;
//# sourceMappingURL=forge-maker.js.map