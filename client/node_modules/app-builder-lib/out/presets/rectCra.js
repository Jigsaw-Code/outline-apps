"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reactCra = void 0;
const builder_util_1 = require("builder-util");
const fs_1 = require("builder-util/out/fs");
const path = require("path");
/** @internal */
async function reactCra(projectDir) {
    if ((await fs_1.statOrNull(path.join(projectDir, "public", "electron.js"))) == null) {
        // noinspection SpellCheckingInspection
        builder_util_1.log.warn("public/electron.js not found. Please see https://medium.com/@kitze/%EF%B8%8F-from-react-to-an-electron-app-ready-for-production-a0468ecb1da3");
    }
    return {
        directories: {
            buildResources: "assets",
        },
        files: ["build/**/*"],
        extraMetadata: {
            main: "build/electron.js",
        },
    };
}
exports.reactCra = reactCra;
//# sourceMappingURL=rectCra.js.map