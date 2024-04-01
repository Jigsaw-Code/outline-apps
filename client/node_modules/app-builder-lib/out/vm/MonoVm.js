"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonoVmManager = void 0;
const builder_util_1 = require("builder-util");
const vm_1 = require("./vm");
class MonoVmManager extends vm_1.VmManager {
    constructor() {
        super();
    }
    exec(file, args, options, isLogOutIfDebug = true) {
        return builder_util_1.exec("mono", [file].concat(args), {
            ...options,
        }, isLogOutIfDebug);
    }
    spawn(file, args, options, extraOptions) {
        return builder_util_1.spawn("mono", [file].concat(args), options, extraOptions);
    }
}
exports.MonoVmManager = MonoVmManager;
//# sourceMappingURL=MonoVm.js.map