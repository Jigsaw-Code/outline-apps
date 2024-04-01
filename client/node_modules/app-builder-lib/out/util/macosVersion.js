"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMacOsCatalina = exports.isMacOsSierra = exports.isMacOsHighSierra = void 0;
const fs_extra_1 = require("fs-extra");
const lazy_val_1 = require("lazy-val");
const semver = require("semver");
const log_1 = require("builder-util/out/log");
const os_1 = require("os");
const macOsVersion = new lazy_val_1.Lazy(async () => {
    const file = await fs_extra_1.readFile("/System/Library/CoreServices/SystemVersion.plist", "utf8");
    const matches = /<key>ProductVersion<\/key>[\s\S]*<string>([\d.]+)<\/string>/.exec(file);
    if (!matches) {
        throw new Error("Couldn't find the macOS version");
    }
    log_1.log.debug({ version: matches[1] }, "macOS version");
    return clean(matches[1]);
});
function clean(version) {
    return version.split(".").length === 2 ? `${version}.0` : version;
}
async function isOsVersionGreaterThanOrEqualTo(input) {
    return semver.gte(await macOsVersion.value, clean(input));
}
function isMacOsHighSierra() {
    // 17.7.0 === 10.13.6
    return process.platform === "darwin" && semver.gte(os_1.release(), "17.7.0");
}
exports.isMacOsHighSierra = isMacOsHighSierra;
async function isMacOsSierra() {
    return process.platform === "darwin" && (await isOsVersionGreaterThanOrEqualTo("10.12.0"));
}
exports.isMacOsSierra = isMacOsSierra;
function isMacOsCatalina() {
    return process.platform === "darwin" && semver.gte(os_1.release(), "19.0.0");
}
exports.isMacOsCatalina = isMacOsCatalina;
//# sourceMappingURL=macosVersion.js.map