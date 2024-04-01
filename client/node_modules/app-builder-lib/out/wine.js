"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareWindowsExecutableArgs = exports.execWine = void 0;
const builder_util_1 = require("builder-util");
/** @private */
function execWine(file, file64 = null, appArgs = [], options = {}) {
    if (process.platform === "win32") {
        if (options.timeout == null) {
            // 2 minutes
            options.timeout = 120 * 1000;
        }
        return builder_util_1.exec(file, appArgs, options);
    }
    const commandArgs = ["wine", "--ia32", file];
    if (file64 != null) {
        commandArgs.push("--x64", file64);
    }
    if (appArgs.length > 0) {
        commandArgs.push("--args", JSON.stringify(appArgs));
    }
    return builder_util_1.executeAppBuilder(commandArgs, undefined, options);
}
exports.execWine = execWine;
/** @private */
function prepareWindowsExecutableArgs(args, exePath) {
    if (process.platform !== "win32") {
        args.unshift(exePath);
    }
    return args;
}
exports.prepareWindowsExecutableArgs = prepareWindowsExecutableArgs;
//# sourceMappingURL=wine.js.map