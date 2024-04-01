"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBin = exports.getBinFromUrl = exports.getBinFromCustomLoc = exports.download = void 0;
const builder_util_1 = require("builder-util");
const versionToPromise = new Map();
function download(url, output, checksum) {
    const args = ["download", "--url", url, "--output", output];
    if (checksum != null) {
        args.push("--sha512", checksum);
    }
    return builder_util_1.executeAppBuilder(args);
}
exports.download = download;
function getBinFromCustomLoc(name, version, binariesLocUrl, checksum) {
    const dirName = `${name}-${version}`;
    return getBin(dirName, binariesLocUrl, checksum);
}
exports.getBinFromCustomLoc = getBinFromCustomLoc;
function getBinFromUrl(name, version, checksum) {
    const dirName = `${name}-${version}`;
    let url;
    if (process.env.ELECTRON_BUILDER_BINARIES_DOWNLOAD_OVERRIDE_URL) {
        url = process.env.ELECTRON_BUILDER_BINARIES_DOWNLOAD_OVERRIDE_URL + "/" + dirName + ".7z";
    }
    else {
        const baseUrl = process.env.NPM_CONFIG_ELECTRON_BUILDER_BINARIES_MIRROR ||
            process.env.npm_config_electron_builder_binaries_mirror ||
            process.env.npm_package_config_electron_builder_binaries_mirror ||
            process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||
            "https://github.com/electron-userland/electron-builder-binaries/releases/download/";
        const middleUrl = process.env.NPM_CONFIG_ELECTRON_BUILDER_BINARIES_CUSTOM_DIR ||
            process.env.npm_config_electron_builder_binaries_custom_dir ||
            process.env.npm_package_config_electron_builder_binaries_custom_dir ||
            process.env.ELECTRON_BUILDER_BINARIES_CUSTOM_DIR ||
            dirName;
        const urlSuffix = dirName + ".7z";
        url = `${baseUrl}${middleUrl}/${urlSuffix}`;
    }
    return getBin(dirName, url, checksum);
}
exports.getBinFromUrl = getBinFromUrl;
function getBin(name, url, checksum) {
    // Old cache is ignored if cache environment variable changes
    const cacheName = `${process.env.ELECTRON_BUILDER_CACHE}${name}`;
    let promise = versionToPromise.get(cacheName); // if rejected, we will try to download again
    if (promise != null) {
        return promise;
    }
    promise = doGetBin(name, url, checksum);
    versionToPromise.set(cacheName, promise);
    return promise;
}
exports.getBin = getBin;
function doGetBin(name, url, checksum) {
    const args = ["download-artifact", "--name", name];
    if (url != null) {
        args.push("--url", url);
    }
    if (checksum != null) {
        args.push("--sha512", checksum);
    }
    return builder_util_1.executeAppBuilder(args);
}
//# sourceMappingURL=binDownload.js.map