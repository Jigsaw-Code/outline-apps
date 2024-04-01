"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.archive = exports.compute7zCompressArgs = exports.tar = void 0;
const _7zip_bin_1 = require("7zip-bin");
const builder_util_1 = require("builder-util");
const fs_1 = require("builder-util/out/fs");
const fs_extra_1 = require("fs-extra");
const path = require("path");
const tar_1 = require("tar");
const tools_1 = require("./tools");
/** @internal */
async function tar(compression, format, outFile, dirToArchive, isMacApp, tempDirManager) {
    const tarFile = await tempDirManager.getTempFile({ suffix: ".tar" });
    const tarArgs = {
        file: tarFile,
        portable: true,
        cwd: dirToArchive,
        prefix: path.basename(outFile, `.${format}`),
    };
    let tarDirectory = ".";
    if (isMacApp) {
        delete tarArgs.prefix;
        tarArgs.cwd = path.dirname(dirToArchive);
        tarDirectory = path.basename(dirToArchive);
    }
    await Promise.all([
        tar_1.create(tarArgs, [tarDirectory]),
        // remove file before - 7z doesn't overwrite file, but update
        fs_1.unlinkIfExists(outFile),
    ]);
    if (format === "tar.lz") {
        // noinspection SpellCheckingInspection
        let lzipPath = "lzip";
        if (process.platform === "darwin") {
            lzipPath = path.join(await tools_1.getLinuxToolsPath(), "bin", lzipPath);
        }
        await builder_util_1.exec(lzipPath, [compression === "store" ? "-1" : "-9", "--keep" /* keep (don't delete) input files */, tarFile]);
        // bloody lzip creates file in the same dir where input file with postfix `.lz`, option --output doesn't work
        await fs_extra_1.move(`${tarFile}.lz`, outFile);
        return;
    }
    const args = compute7zCompressArgs(format === "tar.xz" ? "xz" : format === "tar.bz2" ? "bzip2" : "gzip", {
        isRegularFile: true,
        method: "DEFAULT",
        compression,
    });
    args.push(outFile, tarFile);
    await builder_util_1.exec(_7zip_bin_1.path7za, args, {
        cwd: path.dirname(dirToArchive),
    }, builder_util_1.debug7z.enabled);
}
exports.tar = tar;
function compute7zCompressArgs(format, options = {}) {
    let storeOnly = options.compression === "store";
    const args = debug7zArgs("a");
    let isLevelSet = false;
    if (process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL != null) {
        storeOnly = false;
        args.push(`-mx=${process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL}`);
        isLevelSet = true;
    }
    const isZip = format === "zip";
    if (!storeOnly) {
        if (isZip && options.compression === "maximum") {
            // http://superuser.com/a/742034
            args.push("-mfb=258", "-mpass=15");
        }
        if (!isLevelSet) {
            // https://github.com/electron-userland/electron-builder/pull/3032
            args.push("-mx=" + (!isZip || options.compression === "maximum" ? "9" : "7"));
        }
    }
    if (options.dictSize != null) {
        args.push(`-md=${options.dictSize}m`);
    }
    // https://sevenzip.osdn.jp/chm/cmdline/switches/method.htm#7Z
    // https://stackoverflow.com/questions/27136783/7zip-produces-different-output-from-identical-input
    // tc and ta are off by default, but to be sure, we explicitly set it to off
    // disable "Stores NTFS timestamps for files: Modification time, Creation time, Last access time." to produce the same archive for the same data
    if (!options.isRegularFile) {
        args.push("-mtc=off");
    }
    if (format === "7z" || format.endsWith(".7z")) {
        if (options.solid === false) {
            args.push("-ms=off");
        }
        if (options.isArchiveHeaderCompressed === false) {
            args.push("-mhc=off");
        }
        // args valid only for 7z
        // -mtm=off disable "Stores last Modified timestamps for files."
        args.push("-mtm=off", "-mta=off");
    }
    if (options.method != null) {
        if (options.method !== "DEFAULT") {
            args.push(`-mm=${options.method}`);
        }
    }
    else if (isZip || storeOnly) {
        args.push(`-mm=${storeOnly ? "Copy" : "Deflate"}`);
    }
    if (isZip) {
        // -mcu switch:  7-Zip uses UTF-8, if there are non-ASCII symbols.
        // because default mode: 7-Zip uses UTF-8, if the local code page doesn't contain required symbols.
        // but archive should be the same regardless where produced
        args.push("-mcu");
    }
    return args;
}
exports.compute7zCompressArgs = compute7zCompressArgs;
// 7z is very fast, so, use ultra compression
/** @internal */
async function archive(format, outFile, dirToArchive, options = {}) {
    const args = compute7zCompressArgs(format, options);
    // remove file before - 7z doesn't overwrite file, but update
    await fs_1.unlinkIfExists(outFile);
    args.push(outFile, options.withoutDir ? "." : path.basename(dirToArchive));
    if (options.excluded != null) {
        for (const mask of options.excluded) {
            args.push(`-xr!${mask}`);
        }
    }
    try {
        await builder_util_1.exec(_7zip_bin_1.path7za, args, {
            cwd: options.withoutDir ? dirToArchive : path.dirname(dirToArchive),
        }, builder_util_1.debug7z.enabled);
    }
    catch (e) {
        if (e.code === "ENOENT" && !(await fs_1.exists(dirToArchive))) {
            throw new Error(`Cannot create archive: "${dirToArchive}" doesn't exist`);
        }
        else {
            throw e;
        }
    }
    return outFile;
}
exports.archive = archive;
function debug7zArgs(command) {
    const args = [command, "-bd"];
    if (builder_util_1.debug7z.enabled) {
        args.push("-bb");
    }
    return args;
}
//# sourceMappingURL=archive.js.map