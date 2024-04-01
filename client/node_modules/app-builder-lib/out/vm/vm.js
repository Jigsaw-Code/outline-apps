"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWindowsVm = exports.VmManager = void 0;
const builder_util_1 = require("builder-util");
const path = require("path");
class VmManager {
    get pathSep() {
        return path.sep;
    }
    exec(file, args, options, isLogOutIfDebug = true) {
        return builder_util_1.exec(file, args, options, isLogOutIfDebug);
    }
    spawn(file, args, options, extraOptions) {
        return builder_util_1.spawn(file, args, options, extraOptions);
    }
    toVmFile(file) {
        return file;
    }
}
exports.VmManager = VmManager;
async function getWindowsVm(debugLogger) {
    const parallelsVmModule = await Promise.resolve().then(() => require("./ParallelsVm"));
    const vmList = (await parallelsVmModule.parseVmList(debugLogger)).filter(it => ["win-10", "win-11"].includes(it.os));
    if (vmList.length === 0) {
        throw new builder_util_1.InvalidConfigurationError("Cannot find suitable Parallels Desktop virtual machine (Windows 10 is required)");
    }
    // prefer running or suspended vm
    return new parallelsVmModule.ParallelsVmManager(vmList.find(it => it.state === "running") || vmList.find(it => it.state === "suspended") || vmList[0]);
}
exports.getWindowsVm = getWindowsVm;
//# sourceMappingURL=vm.js.map