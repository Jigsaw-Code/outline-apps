"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LibUiFramework = void 0;
const fs_extra_1 = require("fs-extra");
const promises_1 = require("fs/promises");
const path = require("path");
const builder_util_1 = require("builder-util");
const core_1 = require("../core");
const appBuilder_1 = require("../util/appBuilder");
class LibUiFramework {
    constructor(version, distMacOsAppName, isUseLaunchUi) {
        this.version = version;
        this.distMacOsAppName = distMacOsAppName;
        this.isUseLaunchUi = isUseLaunchUi;
        this.name = "libui";
        // noinspection JSUnusedGlobalSymbols
        this.macOsDefaultTargets = ["dmg"];
        this.defaultAppIdPrefix = "com.libui.";
        // noinspection JSUnusedGlobalSymbols
        this.isCopyElevateHelper = false;
        // noinspection JSUnusedGlobalSymbols
        this.isNpmRebuildRequired = false;
    }
    async prepareApplicationStageDirectory(options) {
        await fs_extra_1.emptyDir(options.appOutDir);
        const packager = options.packager;
        const platform = packager.platform;
        if (this.isUseLaunchUiForPlatform(platform)) {
            const appOutDir = options.appOutDir;
            await builder_util_1.executeAppBuilder([
                "proton-native",
                "--node-version",
                this.version,
                "--use-launch-ui",
                "--platform",
                platform.nodeName,
                "--arch",
                options.arch,
                "--stage",
                appOutDir,
                "--executable",
                `${packager.appInfo.productFilename}${platform === core_1.Platform.WINDOWS ? ".exe" : ""}`,
            ]);
            return;
        }
        if (platform === core_1.Platform.MAC) {
            await this.prepareMacosApplicationStageDirectory(packager, options);
        }
        else if (platform === core_1.Platform.LINUX) {
            await this.prepareLinuxApplicationStageDirectory(options);
        }
    }
    async prepareMacosApplicationStageDirectory(packager, options) {
        const appContentsDir = path.join(options.appOutDir, this.distMacOsAppName, "Contents");
        await promises_1.mkdir(path.join(appContentsDir, "Resources"), { recursive: true });
        await promises_1.mkdir(path.join(appContentsDir, "MacOS"), { recursive: true });
        await builder_util_1.executeAppBuilder(["proton-native", "--node-version", this.version, "--platform", "darwin", "--stage", path.join(appContentsDir, "MacOS")]);
        const appPlist = {
            // https://github.com/albe-rosado/create-proton-app/issues/13
            NSHighResolutionCapable: true,
        };
        await packager.applyCommonInfo(appPlist, appContentsDir);
        await Promise.all([
            appBuilder_1.executeAppBuilderAndWriteJson(["encode-plist"], { [path.join(appContentsDir, "Info.plist")]: appPlist }),
            writeExecutableMain(path.join(appContentsDir, "MacOS", appPlist.CFBundleExecutable), `#!/bin/sh
  DIR=$(dirname "$0")
  "$DIR/node" "$DIR/../Resources/app/${options.packager.info.metadata.main || "index.js"}"
  `),
        ]);
    }
    async prepareLinuxApplicationStageDirectory(options) {
        const appOutDir = options.appOutDir;
        await builder_util_1.executeAppBuilder(["proton-native", "--node-version", this.version, "--platform", "linux", "--arch", options.arch, "--stage", appOutDir]);
        const mainPath = path.join(appOutDir, options.packager.executableName);
        await writeExecutableMain(mainPath, `#!/bin/sh
  DIR=$(dirname "$0")
  "$DIR/node" "$DIR/app/${options.packager.info.metadata.main || "index.js"}"
  `);
    }
    async afterPack(context) {
        const packager = context.packager;
        if (!this.isUseLaunchUiForPlatform(packager.platform)) {
            return;
        }
        // LaunchUI requires main.js, rename if need
        const userMain = packager.info.metadata.main || "index.js";
        if (userMain === "main.js") {
            return;
        }
        await promises_1.rename(path.join(context.appOutDir, "app", userMain), path.join(context.appOutDir, "app", "main.js"));
    }
    getMainFile(platform) {
        return this.isUseLaunchUiForPlatform(platform) ? "main.js" : null;
    }
    isUseLaunchUiForPlatform(platform) {
        return platform === core_1.Platform.WINDOWS || (this.isUseLaunchUi && platform === core_1.Platform.LINUX);
    }
    getExcludedDependencies(platform) {
        // part of launchui
        return this.isUseLaunchUiForPlatform(platform) ? ["libui-node"] : null;
    }
}
exports.LibUiFramework = LibUiFramework;
async function writeExecutableMain(file, content) {
    await promises_1.writeFile(file, content, { mode: 0o755 });
    await promises_1.chmod(file, 0o755);
}
//# sourceMappingURL=LibUiFramework.js.map