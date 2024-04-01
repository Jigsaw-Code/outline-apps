"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.digest = exports.BuildCacheManager = void 0;
const bluebird_lst_1 = require("bluebird-lst");
const builder_util_1 = require("builder-util");
const fs_1 = require("builder-util/out/fs");
const promise_1 = require("builder-util/out/promise");
const fs_extra_1 = require("fs-extra");
const promises_1 = require("fs/promises");
const path = require("path");
class BuildCacheManager {
    constructor(outDir, executableFile, arch) {
        this.executableFile = executableFile;
        this.cacheInfo = null;
        this.newDigest = null;
        this.cacheDir = path.join(outDir, ".cache", builder_util_1.Arch[arch]);
        this.cacheFile = path.join(this.cacheDir, "app.exe");
        this.cacheInfoFile = path.join(this.cacheDir, "info.json");
    }
    async copyIfValid(digest) {
        this.newDigest = digest;
        this.cacheInfo = await promise_1.orNullIfFileNotExist(fs_extra_1.readJson(this.cacheInfoFile));
        const oldDigest = this.cacheInfo == null ? null : this.cacheInfo.executableDigest;
        if (oldDigest !== digest) {
            builder_util_1.log.debug({ oldDigest, newDigest: digest }, "no valid cached executable found");
            return false;
        }
        builder_util_1.log.debug({ cacheFile: this.cacheFile, file: this.executableFile }, `copying cached executable`);
        try {
            await fs_1.copyFile(this.cacheFile, this.executableFile, false);
            return true;
        }
        catch (e) {
            if (e.code === "ENOENT" || e.code === "ENOTDIR") {
                builder_util_1.log.debug({ error: e.code }, "copy cached executable failed");
            }
            else {
                builder_util_1.log.warn({ error: e.stack || e }, `cannot copy cached executable`);
            }
        }
        return false;
    }
    async save() {
        if (this.newDigest == null) {
            throw new Error("call copyIfValid before");
        }
        if (this.cacheInfo == null) {
            this.cacheInfo = { executableDigest: this.newDigest };
        }
        else {
            this.cacheInfo.executableDigest = this.newDigest;
        }
        try {
            await promises_1.mkdir(this.cacheDir, { recursive: true });
            await Promise.all([fs_extra_1.writeJson(this.cacheInfoFile, this.cacheInfo), fs_1.copyFile(this.executableFile, this.cacheFile, false)]);
        }
        catch (e) {
            builder_util_1.log.warn({ error: e.stack || e }, `cannot save build cache`);
        }
    }
}
exports.BuildCacheManager = BuildCacheManager;
BuildCacheManager.VERSION = "0";
async function digest(hash, files) {
    // do not use pipe - better do bulk file read (https://github.com/yarnpkg/yarn/commit/7a63e0d23c46a4564bc06645caf8a59690f04d01)
    for (const content of await bluebird_lst_1.default.map(files, it => promises_1.readFile(it))) {
        hash.update(content);
    }
    hash.update(BuildCacheManager.VERSION);
    return hash.digest("base64");
}
exports.digest = digest;
//# sourceMappingURL=cacheManager.js.map