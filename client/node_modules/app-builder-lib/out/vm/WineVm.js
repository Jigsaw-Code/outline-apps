"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WineVmManager = void 0;
const wine_1 = require("../wine");
const vm_1 = require("./vm");
const path = require("path");
class WineVmManager extends vm_1.VmManager {
    constructor() {
        super();
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    exec(file, args, options, isLogOutIfDebug = true) {
        return wine_1.execWine(file, null, args, options);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    spawn(file, args, options, extraOptions) {
        throw new Error("Unsupported");
    }
    toVmFile(file) {
        return path.win32.join("Z:", file);
    }
}
exports.WineVmManager = WineVmManager;
//# sourceMappingURL=WineVm.js.map