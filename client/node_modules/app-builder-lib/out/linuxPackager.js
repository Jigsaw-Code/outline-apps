"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAppImageOrSnapArch = exports.LinuxPackager = void 0;
const builder_util_1 = require("builder-util");
const core_1 = require("./core");
const platformPackager_1 = require("./platformPackager");
const RemoteBuilder_1 = require("./remoteBuilder/RemoteBuilder");
const LinuxTargetHelper_1 = require("./targets/LinuxTargetHelper");
const targetFactory_1 = require("./targets/targetFactory");
const filename_1 = require("./util/filename");
class LinuxPackager extends platformPackager_1.PlatformPackager {
    constructor(info) {
        super(info, core_1.Platform.LINUX);
        const executableName = this.platformSpecificBuildOptions.executableName;
        this.executableName = executableName == null ? this.appInfo.sanitizedName.toLowerCase() : filename_1.sanitizeFileName(executableName);
    }
    get defaultTarget() {
        return ["snap", "appimage"];
    }
    createTargets(targets, mapper) {
        let helper;
        const getHelper = () => {
            if (helper == null) {
                helper = new LinuxTargetHelper_1.LinuxTargetHelper(this);
            }
            return helper;
        };
        let remoteBuilder = null;
        for (const name of targets) {
            if (name === core_1.DIR_TARGET) {
                continue;
            }
            const targetClass = (() => {
                switch (name) {
                    case "appimage":
                        return require("./targets/AppImageTarget").default;
                    case "snap":
                        return require("./targets/snap").default;
                    case "flatpak":
                        return require("./targets/FlatpakTarget").default;
                    case "deb":
                    case "rpm":
                    case "sh":
                    case "freebsd":
                    case "pacman":
                    case "apk":
                    case "p5p":
                        return require("./targets/fpm").default;
                    default:
                        return null;
                }
            })();
            mapper(name, outDir => {
                if (targetClass === null) {
                    return targetFactory_1.createCommonTarget(name, outDir, this);
                }
                const target = new targetClass(name, this, getHelper(), outDir);
                if (process.platform === "win32" || process.env._REMOTE_BUILD) {
                    if (remoteBuilder == null) {
                        remoteBuilder = new RemoteBuilder_1.RemoteBuilder(this);
                    }
                    // return remoteBuilder.buildTarget(this, arch, appOutDir, this.packager)
                    return new RemoteTarget(target, remoteBuilder);
                }
                return target;
            });
        }
    }
}
exports.LinuxPackager = LinuxPackager;
class RemoteTarget extends core_1.Target {
    constructor(target, remoteBuilder) {
        super(target.name, true /* all must be scheduled in time (so, on finishBuild RemoteBuilder will have all targets added - so, we must set isAsyncSupported to true (resolved promise is returned)) */);
        this.target = target;
        this.remoteBuilder = remoteBuilder;
        this.buildTaskManager = new builder_util_1.AsyncTaskManager(this.remoteBuilder.packager.info.cancellationToken);
    }
    get options() {
        return this.target.options;
    }
    get outDir() {
        return this.target.outDir;
    }
    async finishBuild() {
        await this.buildTaskManager.awaitTasks();
        await this.remoteBuilder.build();
    }
    build(appOutDir, arch) {
        const promise = this.doBuild(appOutDir, arch);
        this.buildTaskManager.addTask(promise);
        return promise;
    }
    async doBuild(appOutDir, arch) {
        builder_util_1.log.info({ target: this.target.name, arch: builder_util_1.Arch[arch] }, "scheduling remote build");
        await this.target.checkOptions();
        this.remoteBuilder.scheduleBuild(this.target, arch, appOutDir);
    }
}
function toAppImageOrSnapArch(arch) {
    switch (arch) {
        case builder_util_1.Arch.x64:
            return "x86_64";
        case builder_util_1.Arch.ia32:
            return "i386";
        case builder_util_1.Arch.armv7l:
            return "arm";
        case builder_util_1.Arch.arm64:
            return "arm_aarch64";
        default:
            throw new Error(`Unsupported arch ${arch}`);
    }
}
exports.toAppImageOrSnapArch = toAppImageOrSnapArch;
//# sourceMappingURL=linuxPackager.js.map