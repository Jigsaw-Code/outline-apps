"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const builder_util_1 = require("builder-util");
const fs_extra_1 = require("fs-extra");
const lazy_val_1 = require("lazy-val");
const path = require("path");
const core_1 = require("../core");
const PublishManager_1 = require("../publish/PublishManager");
const appBuilder_1 = require("../util/appBuilder");
const license_1 = require("../util/license");
const targetUtil_1 = require("./targetUtil");
// https://unix.stackexchange.com/questions/375191/append-to-sub-directory-inside-squashfs-file
class AppImageTarget extends core_1.Target {
    constructor(ignored, packager, helper, outDir) {
        super("appImage");
        this.packager = packager;
        this.helper = helper;
        this.outDir = outDir;
        this.options = { ...this.packager.platformSpecificBuildOptions, ...this.packager.config[this.name] };
        this.desktopEntry = new lazy_val_1.Lazy(() => {
            var _a;
            const args = ((_a = this.options.executableArgs) === null || _a === void 0 ? void 0 : _a.join(" ")) || "--no-sandbox";
            return helper.computeDesktopEntry(this.options, `AppRun ${args} %U`, {
                "X-AppImage-Version": `${packager.appInfo.buildVersion}`,
            });
        });
    }
    async build(appOutDir, arch) {
        const packager = this.packager;
        const options = this.options;
        // https://github.com/electron-userland/electron-builder/issues/775
        // https://github.com/electron-userland/electron-builder/issues/1726
        // tslint:disable-next-line:no-invalid-template-strings
        const artifactName = packager.expandArtifactNamePattern(options, "AppImage", arch);
        const artifactPath = path.join(this.outDir, artifactName);
        await packager.info.callArtifactBuildStarted({
            targetPresentableName: "AppImage",
            file: artifactPath,
            arch,
        });
        const c = await Promise.all([
            this.desktopEntry.value,
            this.helper.icons,
            PublishManager_1.getAppUpdatePublishConfiguration(packager, arch, false /* in any case validation will be done on publish */),
            license_1.getNotLocalizedLicenseFile(options.license, this.packager, ["txt", "html"]),
            targetUtil_1.createStageDir(this, packager, arch),
        ]);
        const license = c[3];
        const stageDir = c[4];
        const publishConfig = c[2];
        if (publishConfig != null) {
            await fs_extra_1.outputFile(path.join(packager.getResourcesDir(stageDir.dir), "app-update.yml"), builder_util_1.serializeToYaml(publishConfig));
        }
        if (this.packager.packagerOptions.effectiveOptionComputed != null &&
            (await this.packager.packagerOptions.effectiveOptionComputed({ desktop: await this.desktopEntry.value }))) {
            return;
        }
        const args = [
            "appimage",
            "--stage",
            stageDir.dir,
            "--arch",
            builder_util_1.Arch[arch],
            "--output",
            artifactPath,
            "--app",
            appOutDir,
            "--configuration",
            JSON.stringify({
                productName: this.packager.appInfo.productName,
                productFilename: this.packager.appInfo.productFilename,
                desktopEntry: c[0],
                executableName: this.packager.executableName,
                icons: c[1],
                fileAssociations: this.packager.fileAssociations,
                ...options,
            }),
        ];
        appBuilder_1.objectToArgs(args, {
            license,
        });
        if (packager.compression === "maximum") {
            args.push("--compression", "xz");
        }
        await packager.info.callArtifactBuildCompleted({
            file: artifactPath,
            safeArtifactName: packager.computeSafeArtifactName(artifactName, "AppImage", arch, false),
            target: this,
            arch,
            packager,
            isWriteUpdateInfo: true,
            updateInfo: await appBuilder_1.executeAppBuilderAsJson(args),
        });
    }
}
exports.default = AppImageTarget;
//# sourceMappingURL=AppImageTarget.js.map