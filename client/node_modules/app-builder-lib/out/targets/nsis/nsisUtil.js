"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UninstallerReader = exports.CopyElevateHelper = exports.AppPackageHelper = exports.NSIS_PATH = exports.NsisTargetOptions = exports.nsisTemplatesDir = void 0;
const builder_util_1 = require("builder-util");
const binDownload_1 = require("../../binDownload");
const fs_1 = require("builder-util/out/fs");
const path = require("path");
const pathManager_1 = require("../../util/pathManager");
const fs = require("fs/promises");
const zlib = require("zlib");
exports.nsisTemplatesDir = pathManager_1.getTemplatePath("nsis");
exports.NsisTargetOptions = (() => {
    let _resolve;
    const promise = new Promise(resolve => (_resolve = resolve));
    return {
        then: (callback) => promise.then(callback),
        resolve: (options) => _resolve(options),
    };
})();
const NSIS_PATH = () => {
    const custom = process.env.ELECTRON_BUILDER_NSIS_DIR;
    if (custom != null && custom.length > 0) {
        return Promise.resolve(custom.trim());
    }
    return exports.NsisTargetOptions.then((options) => {
        if (options.customNsisBinary) {
            const { checksum, url, version } = options.customNsisBinary;
            if (checksum && url) {
                const binaryVersion = version || checksum.substr(0, 8);
                return binDownload_1.getBinFromCustomLoc("nsis", binaryVersion, url, checksum);
            }
        }
        // Warning: Don't use v3.0.4.2 - https://github.com/electron-userland/electron-builder/issues/6334
        // noinspection SpellCheckingInspection
        return binDownload_1.getBinFromUrl("nsis", "3.0.4.1", "VKMiizYdmNdJOWpRGz4trl4lD++BvYP2irAXpMilheUP0pc93iKlWAoP843Vlraj8YG19CVn0j+dCo/hURz9+Q==");
    });
};
exports.NSIS_PATH = NSIS_PATH;
class AppPackageHelper {
    constructor(elevateHelper) {
        this.elevateHelper = elevateHelper;
        this.archToFileInfo = new Map();
        this.infoToIsDelete = new Map();
        /** @private */
        this.refCount = 0;
    }
    async packArch(arch, target) {
        let infoPromise = this.archToFileInfo.get(arch);
        if (infoPromise == null) {
            const appOutDir = target.archs.get(arch);
            infoPromise = this.elevateHelper.copy(appOutDir, target).then(() => target.buildAppPackage(appOutDir, arch));
            this.archToFileInfo.set(arch, infoPromise);
        }
        const info = await infoPromise;
        if (target.isWebInstaller) {
            this.infoToIsDelete.set(info, false);
        }
        else if (!this.infoToIsDelete.has(info)) {
            this.infoToIsDelete.set(info, true);
        }
        return info;
    }
    async finishBuild() {
        if (--this.refCount > 0) {
            return;
        }
        const filesToDelete = [];
        for (const [info, isDelete] of this.infoToIsDelete.entries()) {
            if (isDelete) {
                filesToDelete.push(info.path);
            }
        }
        await Promise.all(filesToDelete.map(it => fs.unlink(it)));
    }
}
exports.AppPackageHelper = AppPackageHelper;
class CopyElevateHelper {
    constructor() {
        this.copied = new Map();
    }
    copy(appOutDir, target) {
        if (!target.packager.info.framework.isCopyElevateHelper) {
            return Promise.resolve();
        }
        let isPackElevateHelper = target.options.packElevateHelper;
        if (isPackElevateHelper === false && target.options.perMachine === true) {
            isPackElevateHelper = true;
            builder_util_1.log.warn("`packElevateHelper = false` is ignored, because `perMachine` is set to `true`");
        }
        if (isPackElevateHelper === false) {
            return Promise.resolve();
        }
        let promise = this.copied.get(appOutDir);
        if (promise != null) {
            return promise;
        }
        promise = exports.NSIS_PATH().then(it => {
            const outFile = path.join(appOutDir, "resources", "elevate.exe");
            const promise = fs_1.copyFile(path.join(it, "elevate.exe"), outFile, false);
            if (target.packager.platformSpecificBuildOptions.signAndEditExecutable !== false) {
                return promise.then(() => target.packager.sign(outFile));
            }
            return promise;
        });
        this.copied.set(appOutDir, promise);
        return promise;
    }
}
exports.CopyElevateHelper = CopyElevateHelper;
class BinaryReader {
    constructor(buffer) {
        this._buffer = buffer;
        this._position = 0;
    }
    get length() {
        return this._buffer.length;
    }
    get position() {
        return this._position;
    }
    match(signature) {
        if (signature.every((v, i) => this._buffer[this._position + i] === v)) {
            this._position += signature.length;
            return true;
        }
        return false;
    }
    skip(offset) {
        this._position += offset;
    }
    bytes(size) {
        const value = this._buffer.subarray(this._position, this._position + size);
        this._position += size;
        return value;
    }
    uint16() {
        const value = this._buffer[this._position] | (this._buffer[this._position + 1] << 8);
        this._position += 2;
        return value;
    }
    uint32() {
        return this.uint16() | (this.uint16() << 16);
    }
    string(length) {
        let value = "";
        for (let i = 0; i < length; i++) {
            const c = this._buffer[this._position + i];
            if (c === 0x00) {
                break;
            }
            value += String.fromCharCode(c);
        }
        this._position += length;
        return value;
    }
}
class UninstallerReader {
    // noinspection SpellCheckingInspection
    static async exec(installerPath, uninstallerPath) {
        const buffer = await fs.readFile(installerPath);
        const reader = new BinaryReader(buffer);
        // IMAGE_DOS_HEADER
        if (!reader.match([0x4d, 0x5a])) {
            throw new Error("Invalid 'MZ' signature.");
        }
        reader.skip(58);
        // e_lfanew
        reader.skip(reader.uint32() - reader.position);
        // IMAGE_FILE_HEADER
        if (!reader.match([0x50, 0x45, 0x00, 0x00])) {
            throw new Error("Invalid 'PE' signature.");
        }
        reader.skip(2);
        const numberOfSections = reader.uint16();
        reader.skip(12);
        const sizeOfOptionalHeader = reader.uint16();
        reader.skip(2);
        reader.skip(sizeOfOptionalHeader);
        // IMAGE_SECTION_HEADER
        let nsisOffset = 0;
        for (let i = 0; i < numberOfSections; i++) {
            const name = reader.string(8);
            reader.skip(8);
            const rawSize = reader.uint32();
            const rawPointer = reader.uint32();
            reader.skip(16);
            switch (name) {
                case ".text":
                case ".rdata":
                case ".data":
                case ".rsrc": {
                    nsisOffset = Math.max(rawPointer + rawSize, nsisOffset);
                    break;
                }
                default: {
                    if (rawPointer !== 0 && rawSize !== 0) {
                        throw new Error("Unsupported section '" + name + "'.");
                    }
                    break;
                }
            }
        }
        const executable = buffer.subarray(0, nsisOffset);
        const nsisSize = buffer.length - nsisOffset;
        const nsisReader = new BinaryReader(buffer.subarray(nsisOffset, nsisOffset + nsisSize));
        const nsisSignature = [0xef, 0xbe, 0xad, 0xde, 0x4e, 0x75, 0x6c, 0x6c, 0x73, 0x6f, 0x66, 0x74, 0x49, 0x6e, 0x73, 0x74];
        nsisReader.uint32(); // ?
        if (!nsisReader.match(nsisSignature)) {
            throw new Error("Invalid signature.");
        }
        nsisReader.uint32(); // ?
        if (nsisSize !== nsisReader.uint32()) {
            throw new Error("Size mismatch.");
        }
        let innerBuffer = null;
        while (true) {
            let size = nsisReader.uint32();
            const compressed = (size & 0x80000000) !== 0;
            size = size & 0x7fffffff;
            if (size === 0 || nsisReader.position + size > nsisReader.length || nsisReader.position >= nsisReader.length) {
                break;
            }
            let buffer = nsisReader.bytes(size);
            if (compressed) {
                buffer = zlib.inflateRawSync(buffer);
            }
            const innerReader = new BinaryReader(buffer);
            innerReader.uint32(); // ?
            if (innerReader.match(nsisSignature)) {
                if (innerBuffer) {
                    throw new Error("Multiple inner blocks.");
                }
                innerBuffer = buffer;
            }
        }
        if (!innerBuffer) {
            throw new Error("Inner block not found.");
        }
        await fs.writeFile(uninstallerPath, executable);
        await fs.appendFile(uninstallerPath, innerBuffer);
    }
}
exports.UninstallerReader = UninstallerReader;
//# sourceMappingURL=nsisUtil.js.map