"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArchiveTarget = void 0;
const builder_util_1 = require("builder-util");
const path = require("path");
const core_1 = require("../core");
const fileMatcher_1 = require("../fileMatcher");
const archive_1 = require("./archive");
const differentialUpdateInfoBuilder_1 = require("./differentialUpdateInfoBuilder");
class ArchiveTarget extends core_1.Target {
    constructor(name, outDir, packager, isWriteUpdateInfo = false) {
        super(name);
        this.outDir = outDir;
        this.packager = packager;
        this.isWriteUpdateInfo = isWriteUpdateInfo;
        this.options = this.packager.config[this.name];
    }
    async build(appOutDir, arch) {
        const packager = this.packager;
        const isMac = packager.platform === core_1.Platform.MAC;
        const format = this.name;
        let defaultPattern;
        const defaultArch = builder_util_1.defaultArchFromString(packager.platformSpecificBuildOptions.defaultArch);
        if (packager.platform === core_1.Platform.LINUX) {
            // tslint:disable-next-line:no-invalid-template-strings
            defaultPattern = "${name}-${version}" + (arch === defaultArch ? "" : "-${arch}") + ".${ext}";
        }
        else {
            // tslint:disable-next-line:no-invalid-template-strings
            defaultPattern = "${productName}-${version}" + (arch === defaultArch ? "" : "-${arch}") + "-${os}.${ext}";
        }
        const artifactName = packager.expandArtifactNamePattern(this.options, format, arch, defaultPattern, false);
        const artifactPath = path.join(this.outDir, artifactName);
        await packager.info.callArtifactBuildStarted({
            targetPresentableName: `${isMac ? "macOS " : ""}${format}`,
            file: artifactPath,
            arch,
        });
        let updateInfo = null;
        if (format.startsWith("tar.")) {
            await archive_1.tar(packager.compression, format, artifactPath, appOutDir, isMac, packager.info.tempDirManager);
        }
        else {
            let withoutDir = !isMac;
            let dirToArchive = appOutDir;
            if (isMac) {
                dirToArchive = path.dirname(appOutDir);
                const fileMatchers = fileMatcher_1.getFileMatchers(packager.config, "extraDistFiles", dirToArchive, packager.createGetFileMatchersOptions(this.outDir, arch, packager.platformSpecificBuildOptions));
                if (fileMatchers == null) {
                    dirToArchive = appOutDir;
                }
                else {
                    await fileMatcher_1.copyFiles(fileMatchers, null, true);
                    withoutDir = true;
                }
            }
            const archiveOptions = {
                compression: packager.compression,
                withoutDir,
            };
            await archive_1.archive(format, artifactPath, dirToArchive, archiveOptions);
            if (this.isWriteUpdateInfo && format === "zip") {
                if (isMac) {
                    updateInfo = await differentialUpdateInfoBuilder_1.createBlockmap(artifactPath, this, packager, artifactName);
                }
                else {
                    updateInfo = await differentialUpdateInfoBuilder_1.appendBlockmap(artifactPath);
                }
            }
        }
        await packager.info.callArtifactBuildCompleted({
            updateInfo,
            file: artifactPath,
            // tslint:disable-next-line:no-invalid-template-strings
            safeArtifactName: packager.computeSafeArtifactName(artifactName, format, arch, false, packager.platformSpecificBuildOptions.defaultArch, defaultPattern.replace("${productName}", "${name}")),
            target: this,
            arch,
            packager,
            isWriteUpdateInfo: this.isWriteUpdateInfo,
        });
    }
}
exports.ArchiveTarget = ArchiveTarget;
//# sourceMappingURL=ArchiveTarget.js.map