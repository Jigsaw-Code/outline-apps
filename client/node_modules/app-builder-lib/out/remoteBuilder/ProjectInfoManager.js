"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectInfoManager = void 0;
const fs_extra_1 = require("fs-extra");
const lazy_val_1 = require("lazy-val");
const path = require("path");
class ProjectInfoManager {
    constructor(packager) {
        this.packager = packager;
        this.infoFile = new lazy_val_1.Lazy(() => this.saveConfigurationAndMetadata());
    }
    async saveConfigurationAndMetadata() {
        const packager = this.packager;
        const tempDir = await packager.tempDirManager.createTempDir({ prefix: "remote-build-metadata" });
        // we cannot use getTempFile because file name must be constant
        const info = {
            metadata: packager.metadata,
            configuration: packager.config,
            repositoryInfo: await packager.repositoryInfo,
            buildResourceDirName: path.basename(packager.buildResourcesDir),
        };
        if (packager.metadata !== packager.devMetadata && packager.devMetadata != null) {
            info.devMetadata = packager.devMetadata;
        }
        const file = path.join(tempDir, "info.json");
        await fs_extra_1.outputJson(file, info);
        return file;
    }
}
exports.ProjectInfoManager = ProjectInfoManager;
//# sourceMappingURL=ProjectInfoManager.js.map