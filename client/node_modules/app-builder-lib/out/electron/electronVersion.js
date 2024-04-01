"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeElectronVersion = exports.getElectronPackage = exports.getElectronVersionFromInstalled = exports.getElectronVersion = void 0;
const builder_util_1 = require("builder-util");
const builder_util_runtime_1 = require("builder-util-runtime");
const nodeHttpExecutor_1 = require("builder-util/out/nodeHttpExecutor");
const fs_extra_1 = require("fs-extra");
const lazy_val_1 = require("lazy-val");
const path = require("path");
const read_config_file_1 = require("read-config-file");
const semver = require("semver");
const config_1 = require("../util/config");
const electronPackages = ["electron", "electron-prebuilt", "electron-prebuilt-compile", "electron-nightly"];
async function getElectronVersion(projectDir, config, projectMetadata = new lazy_val_1.Lazy(() => read_config_file_1.orNullIfFileNotExist(fs_extra_1.readJson(path.join(projectDir, "package.json"))))) {
    if (config == null) {
        config = await config_1.getConfig(projectDir, null, null);
    }
    if (config.electronVersion != null) {
        return config.electronVersion;
    }
    return await computeElectronVersion(projectDir, projectMetadata);
}
exports.getElectronVersion = getElectronVersion;
async function getElectronVersionFromInstalled(projectDir) {
    for (const name of electronPackages) {
        try {
            return (await fs_extra_1.readJson(path.join(projectDir, "node_modules", name, "package.json"))).version;
        }
        catch (e) {
            if (e.code !== "ENOENT") {
                builder_util_1.log.warn({ name, error: e }, `cannot read electron version package.json`);
            }
        }
    }
    return null;
}
exports.getElectronVersionFromInstalled = getElectronVersionFromInstalled;
async function getElectronPackage(projectDir) {
    for (const name of electronPackages) {
        try {
            return await fs_extra_1.readJson(path.join(projectDir, "node_modules", name, "package.json"));
        }
        catch (e) {
            if (e.code !== "ENOENT") {
                builder_util_1.log.warn({ name, error: e }, `cannot find electron in package.json`);
            }
        }
    }
    return null;
}
exports.getElectronPackage = getElectronPackage;
/** @internal */
async function computeElectronVersion(projectDir, projectMetadata) {
    const result = await getElectronVersionFromInstalled(projectDir);
    if (result != null) {
        return result;
    }
    const dependency = findFromPackageMetadata(await projectMetadata.value);
    if ((dependency === null || dependency === void 0 ? void 0 : dependency.name) === "electron-nightly") {
        builder_util_1.log.info("You are using a nightly version of electron, be warned that those builds are highly unstable.");
        const feedXml = await nodeHttpExecutor_1.httpExecutor.request({
            hostname: "github.com",
            path: `/electron/nightlies/releases.atom`,
            headers: {
                accept: "application/xml, application/atom+xml, text/xml, */*",
            },
        });
        const feed = builder_util_runtime_1.parseXml(feedXml);
        const latestRelease = feed.element("entry", false, `No published versions on GitHub`);
        const v = /\/tag\/v?([^/]+)$/.exec(latestRelease.element("link").attribute("href"))[1];
        return v.startsWith("v") ? v.substring(1) : v;
    }
    else if ((dependency === null || dependency === void 0 ? void 0 : dependency.version) === "latest") {
        builder_util_1.log.warn('Electron version is set to "latest", but it is recommended to set it to some more restricted version range.');
        try {
            const releaseInfo = JSON.parse((await nodeHttpExecutor_1.httpExecutor.request({
                hostname: "github.com",
                path: `/electron/${dependency.name === "electron-nightly" ? "nightlies" : "electron"}/releases/latest`,
                headers: {
                    accept: "application/json",
                },
            })));
            const version = releaseInfo.tag_name.startsWith("v") ? releaseInfo.tag_name.substring(1) : releaseInfo.tag_name;
            builder_util_1.log.info({ version }, `resolve ${dependency.name}@${dependency.version}`);
            return version;
        }
        catch (e) {
            builder_util_1.log.warn(e);
        }
        throw new builder_util_1.InvalidConfigurationError(`Cannot find electron dependency to get electron version in the '${path.join(projectDir, "package.json")}'`);
    }
    const version = dependency === null || dependency === void 0 ? void 0 : dependency.version;
    if (version == null || !/^\d/.test(version)) {
        const versionMessage = version == null ? "" : ` and version ("${version}") is not fixed in project`;
        throw new builder_util_1.InvalidConfigurationError(`Cannot compute electron version from installed node modules - none of the possible electron modules are installed${versionMessage}.\nSee https://github.com/electron-userland/electron-builder/issues/3984#issuecomment-504968246`);
    }
    return semver.coerce(version).toString();
}
exports.computeElectronVersion = computeElectronVersion;
function findFromPackageMetadata(packageData) {
    for (const name of electronPackages) {
        const devDependencies = packageData.devDependencies;
        let dep = devDependencies == null ? null : devDependencies[name];
        if (dep == null) {
            const dependencies = packageData.dependencies;
            dep = dependencies == null ? null : dependencies[name];
        }
        if (dep != null) {
            return { name, version: dep };
        }
    }
    return null;
}
//# sourceMappingURL=electronVersion.js.map