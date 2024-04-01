"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectUnpackedDirs = exports.isLibOrExe = void 0;
const bluebird_lst_1 = require("bluebird-lst");
const builder_util_1 = require("builder-util");
const fs_1 = require("builder-util/out/fs");
const fs_extra_1 = require("fs-extra");
const isbinaryfile_1 = require("isbinaryfile");
const path = require("path");
const fileTransformer_1 = require("../fileTransformer");
const appFileCopier_1 = require("../util/appFileCopier");
function addValue(map, key, value) {
    let list = map.get(key);
    if (list == null) {
        list = [value];
        map.set(key, list);
    }
    else {
        list.push(value);
    }
}
function isLibOrExe(file) {
    return file.endsWith(".dll") || file.endsWith(".exe") || file.endsWith(".dylib") || file.endsWith(".so");
}
exports.isLibOrExe = isLibOrExe;
/** @internal */
async function detectUnpackedDirs(fileSet, autoUnpackDirs, unpackedDest, rootForAppFilesWithoutAsar) {
    const dirToCreate = new Map();
    const metadata = fileSet.metadata;
    function addParents(child, root) {
        child = path.dirname(child);
        if (autoUnpackDirs.has(child)) {
            return;
        }
        do {
            autoUnpackDirs.add(child);
            const p = path.dirname(child);
            // create parent dir to be able to copy file later without directory existence check
            addValue(dirToCreate, p, path.basename(child));
            if (child === root || p === root || autoUnpackDirs.has(p)) {
                break;
            }
            child = p;
        } while (true);
        autoUnpackDirs.add(root);
    }
    for (let i = 0, n = fileSet.files.length; i < n; i++) {
        const file = fileSet.files[i];
        const index = file.lastIndexOf(fileTransformer_1.NODE_MODULES_PATTERN);
        if (index < 0) {
            continue;
        }
        let nextSlashIndex = file.indexOf(path.sep, index + fileTransformer_1.NODE_MODULES_PATTERN.length + 1);
        if (nextSlashIndex < 0) {
            continue;
        }
        if (file[index + fileTransformer_1.NODE_MODULES_PATTERN.length] === "@") {
            nextSlashIndex = file.indexOf(path.sep, nextSlashIndex + 1);
        }
        if (!metadata.get(file).isFile()) {
            continue;
        }
        const packageDir = file.substring(0, nextSlashIndex);
        const packageDirPathInArchive = path.relative(rootForAppFilesWithoutAsar, appFileCopier_1.getDestinationPath(packageDir, fileSet));
        const pathInArchive = path.relative(rootForAppFilesWithoutAsar, appFileCopier_1.getDestinationPath(file, fileSet));
        if (autoUnpackDirs.has(packageDirPathInArchive)) {
            // if package dir is unpacked, any file also unpacked
            addParents(pathInArchive, packageDirPathInArchive);
            continue;
        }
        // https://github.com/electron-userland/electron-builder/issues/2679
        let shouldUnpack = false;
        // ffprobe-static and ffmpeg-static are known packages to always unpack
        const moduleName = path.basename(packageDir);
        if (moduleName === "ffprobe-static" || moduleName === "ffmpeg-static" || isLibOrExe(file)) {
            shouldUnpack = true;
        }
        else if (!file.includes(".", nextSlashIndex)) {
            shouldUnpack = !!isbinaryfile_1.isBinaryFileSync(file);
        }
        if (!shouldUnpack) {
            continue;
        }
        if (builder_util_1.log.isDebugEnabled) {
            builder_util_1.log.debug({ file: pathInArchive, reason: "contains executable code" }, "not packed into asar archive");
        }
        addParents(pathInArchive, packageDirPathInArchive);
    }
    if (dirToCreate.size > 0) {
        await fs_extra_1.mkdir(`${unpackedDest + path.sep}node_modules`, { recursive: true });
        // child directories should be not created asynchronously - parent directories should be created first
        await bluebird_lst_1.default.map(dirToCreate.keys(), async (parentDir) => {
            const base = unpackedDest + path.sep + parentDir;
            await fs_extra_1.mkdir(base, { recursive: true });
            await bluebird_lst_1.default.each(dirToCreate.get(parentDir), (it) => {
                if (dirToCreate.has(parentDir + path.sep + it)) {
                    // already created
                    return null;
                }
                else {
                    return fs_extra_1.mkdir(base + path.sep + it, { recursive: true });
                }
            });
        }, fs_1.CONCURRENCY);
    }
}
exports.detectUnpackedDirs = detectUnpackedDirs;
//# sourceMappingURL=unpackDetector.js.map