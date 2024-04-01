"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBlockmap = exports.appendBlockmap = exports.configureDifferentialAwareArchiveOptions = exports.createNsisWebDifferentialUpdateInfo = exports.BLOCK_MAP_FILE_SUFFIX = void 0;
const builder_util_1 = require("builder-util");
const path = require("path");
const appBuilder_1 = require("../util/appBuilder");
exports.BLOCK_MAP_FILE_SUFFIX = ".blockmap";
function createNsisWebDifferentialUpdateInfo(artifactPath, packageFiles) {
    if (packageFiles == null) {
        return null;
    }
    const keys = Object.keys(packageFiles);
    if (keys.length <= 0) {
        return null;
    }
    const packages = {};
    for (const arch of keys) {
        const packageFileInfo = packageFiles[arch];
        const file = path.basename(packageFileInfo.path);
        packages[arch] = {
            ...packageFileInfo,
            path: file,
            // https://github.com/electron-userland/electron-builder/issues/2583
            file,
        };
    }
    return { packages };
}
exports.createNsisWebDifferentialUpdateInfo = createNsisWebDifferentialUpdateInfo;
function configureDifferentialAwareArchiveOptions(archiveOptions) {
    /*
     * dict size 64 MB: Full: 33,744.88 KB, To download: 17,630.3 KB (52%)
     * dict size 16 MB: Full: 33,936.84 KB, To download: 16,175.9 KB (48%)
     * dict size  8 MB: Full: 34,187.59 KB, To download:  8,229.9 KB (24%)
     * dict size  4 MB: Full: 34,628.73 KB, To download: 3,782.97 KB (11%)
  
     as we can see, if file changed in one place, all block is invalidated (and update size approximately equals to dict size)
  
     1 MB is used:
  
     1MB:
  
     2018/01/11 11:54:41:0045 File has 59 changed blocks
     2018/01/11 11:54:41:0050 Full: 71,588.59 KB, To download: 1,243.39 KB (2%)
  
     4MB:
  
     2018/01/11 11:31:43:0440 Full: 70,303.55 KB, To download: 4,843.27 KB (7%)
     2018/01/11 11:31:43:0435 File has 234 changed blocks
  
     */
    archiveOptions.dictSize = 1;
    // solid compression leads to a lot of changed blocks
    archiveOptions.solid = false;
    // do not allow to change compression level to avoid different packages
    archiveOptions.compression = "normal";
    return archiveOptions;
}
exports.configureDifferentialAwareArchiveOptions = configureDifferentialAwareArchiveOptions;
async function appendBlockmap(file) {
    builder_util_1.log.info({ file: builder_util_1.log.filePath(file) }, "building embedded block map");
    return await appBuilder_1.executeAppBuilderAsJson(["blockmap", "--input", file, "--compression", "deflate"]);
}
exports.appendBlockmap = appendBlockmap;
async function createBlockmap(file, target, packager, safeArtifactName) {
    const blockMapFile = `${file}${exports.BLOCK_MAP_FILE_SUFFIX}`;
    builder_util_1.log.info({ blockMapFile: builder_util_1.log.filePath(blockMapFile) }, "building block map");
    const updateInfo = await appBuilder_1.executeAppBuilderAsJson(["blockmap", "--input", file, "--output", blockMapFile]);
    await packager.info.callArtifactBuildCompleted({
        file: blockMapFile,
        safeArtifactName: safeArtifactName == null ? null : `${safeArtifactName}${exports.BLOCK_MAP_FILE_SUFFIX}`,
        target,
        arch: null,
        packager,
        updateInfo,
    });
    return updateInfo;
}
exports.createBlockmap = createBlockmap;
//# sourceMappingURL=differentialUpdateInfoBuilder.js.map