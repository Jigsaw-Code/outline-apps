"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.macPathToParallelsWindows = exports.ParallelsVmManager = exports.parseVmList = void 0;
const builder_util_1 = require("builder-util");
const child_process_1 = require("child_process");
const vm_1 = require("./vm");
/** @internal */
async function parseVmList(debugLogger) {
    // do not log output if debug - it is huge, logged using debugLogger
    let rawList = await builder_util_1.exec("prlctl", ["list", "-i", "-s", "name"], undefined, false);
    debugLogger.add("parallels.list", rawList);
    rawList = rawList.substring(rawList.indexOf("ID:"));
    // let match: Array<string> | null
    const result = [];
    for (const info of rawList
        .split("\n\n")
        .map(it => it.trim())
        .filter(it => it.length > 0)) {
        const vm = {};
        for (const line of info.split("\n")) {
            const meta = /^([^:("]+): (.*)$/.exec(line);
            if (meta == null) {
                continue;
            }
            const key = meta[1].toLowerCase();
            if (key === "id" || key === "os" || key === "name" || key === "state" || key === "name") {
                vm[key] = meta[2].trim();
            }
        }
        result.push(vm);
    }
    return result;
}
exports.parseVmList = parseVmList;
/** @internal */
class ParallelsVmManager extends vm_1.VmManager {
    constructor(vm) {
        super();
        this.vm = vm;
        this.isExitHookAdded = false;
        this.startPromise = this.doStartVm();
    }
    get pathSep() {
        return "/";
    }
    handleExecuteError(error) {
        if (error.message.includes("Unable to open new session in this virtual machine")) {
            throw new Error(`Please ensure that your are logged in "${this.vm.name}" parallels virtual machine. In the future please do not stop VM, but suspend.\n\n${error.message}`);
        }
        builder_util_1.log.warn("ensure that 'Share folders' is set to 'All Disks', see https://goo.gl/E6XphP");
        throw error;
    }
    async exec(file, args, options) {
        await this.ensureThatVmStarted();
        // it is important to use "--current-user" to execute command under logged in user - to access certs.
        return await builder_util_1.exec("prlctl", ["exec", this.vm.id, "--current-user", file.startsWith("/") ? macPathToParallelsWindows(file) : file].concat(args), options).catch(error => this.handleExecuteError(error));
    }
    async spawn(file, args, options, extraOptions) {
        await this.ensureThatVmStarted();
        return await builder_util_1.spawn("prlctl", ["exec", this.vm.id, file].concat(args), options, extraOptions).catch(error => this.handleExecuteError(error));
    }
    async doStartVm() {
        const vmId = this.vm.id;
        const state = this.vm.state;
        if (state === "running") {
            return;
        }
        if (!this.isExitHookAdded) {
            this.isExitHookAdded = true;
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            require("async-exit-hook")((callback) => {
                const stopArgs = ["suspend", vmId];
                if (callback == null) {
                    child_process_1.execFileSync("prlctl", stopArgs);
                }
                else {
                    builder_util_1.exec("prlctl", stopArgs).then(callback).catch(callback);
                }
            });
        }
        await builder_util_1.exec("prlctl", ["start", vmId]);
    }
    ensureThatVmStarted() {
        let startPromise = this.startPromise;
        if (startPromise == null) {
            startPromise = this.doStartVm();
            this.startPromise = startPromise;
        }
        return startPromise;
    }
    toVmFile(file) {
        // https://stackoverflow.com/questions/4742992/cannot-access-network-drive-in-powershell-running-as-administrator
        return macPathToParallelsWindows(file);
    }
}
exports.ParallelsVmManager = ParallelsVmManager;
function macPathToParallelsWindows(file) {
    if (file.startsWith("C:\\")) {
        return file;
    }
    return "\\\\Mac\\Host\\" + file.replace(/\//g, "\\");
}
exports.macPathToParallelsWindows = macPathToParallelsWindows;
//# sourceMappingURL=ParallelsVm.js.map