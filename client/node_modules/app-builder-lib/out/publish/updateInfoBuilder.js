"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeUpdateInfoFiles = exports.createUpdateInfoTasks = void 0;
const bluebird_lst_1 = require("bluebird-lst");
const builder_util_1 = require("builder-util");
const fs_extra_1 = require("fs-extra");
const lazy_val_1 = require("lazy-val");
const path = require("path");
const semver = require("semver");
const core_1 = require("../core");
const hash_1 = require("../util/hash");
const PublishManager_1 = require("./PublishManager");
async function getReleaseInfo(packager) {
    const releaseInfo = { ...(packager.platformSpecificBuildOptions.releaseInfo || packager.config.releaseInfo) };
    if (releaseInfo.releaseNotes == null) {
        const releaseNotesFile = await packager.getResource(releaseInfo.releaseNotesFile, `release-notes-${packager.platform.buildConfigurationKey}.md`, `release-notes-${packager.platform.name}.md`, `release-notes-${packager.platform.nodeName}.md`, "release-notes.md");
        const releaseNotes = releaseNotesFile == null ? null : await fs_extra_1.readFile(releaseNotesFile, "utf-8");
        // to avoid undefined in the file, check for null
        if (releaseNotes != null) {
            releaseInfo.releaseNotes = releaseNotes;
        }
    }
    delete releaseInfo.releaseNotesFile;
    return releaseInfo;
}
function isGenerateUpdatesFilesForAllChannels(packager) {
    const value = packager.platformSpecificBuildOptions.generateUpdatesFilesForAllChannels;
    return value == null ? packager.config.generateUpdatesFilesForAllChannels : value;
}
/**
 if this is an "alpha" version, we need to generate only the "alpha" .yml file
 if this is a "beta" version, we need to generate both the "alpha" and "beta" .yml file
 if this is a "stable" version, we need to generate all the "alpha", "beta" and "stable" .yml file
 */
function computeChannelNames(packager, publishConfig) {
    const currentChannel = publishConfig.channel || "latest";
    // for GitHub should be pre-release way be used
    if (currentChannel === "alpha" || publishConfig.provider === "github" || !isGenerateUpdatesFilesForAllChannels(packager)) {
        return [currentChannel];
    }
    switch (currentChannel) {
        case "beta":
            return [currentChannel, "alpha"];
        case "latest":
            return [currentChannel, "alpha", "beta"];
        default:
            return [currentChannel];
    }
}
function getUpdateInfoFileName(channel, packager, arch) {
    const osSuffix = packager.platform === core_1.Platform.WINDOWS ? "" : `-${packager.platform.buildConfigurationKey}`;
    return `${channel}${osSuffix}${getArchPrefixForUpdateFile(arch, packager)}.yml`;
}
function getArchPrefixForUpdateFile(arch, packager) {
    if (arch == null || arch === builder_util_1.Arch.x64 || packager.platform !== core_1.Platform.LINUX) {
        return "";
    }
    return arch === builder_util_1.Arch.armv7l ? "-arm" : `-${builder_util_1.Arch[arch]}`;
}
function computeIsisElectronUpdater1xCompatibility(updaterCompatibility, publishConfiguration, packager) {
    if (updaterCompatibility != null) {
        return semver.satisfies("1.0.0", updaterCompatibility);
    }
    // spaces is a new publish provider, no need to keep backward compatibility
    if (publishConfiguration.provider === "spaces") {
        return false;
    }
    const updaterVersion = packager.metadata.dependencies == null ? null : packager.metadata.dependencies["electron-updater"];
    return updaterVersion == null || semver.lt(updaterVersion, "4.0.0");
}
/** @internal */
async function createUpdateInfoTasks(event, _publishConfigs) {
    const packager = event.packager;
    const publishConfigs = await PublishManager_1.getPublishConfigsForUpdateInfo(packager, _publishConfigs, event.arch);
    if (publishConfigs == null || publishConfigs.length === 0) {
        return [];
    }
    const outDir = event.target.outDir;
    const version = packager.appInfo.version;
    const sha2 = new lazy_val_1.Lazy(() => hash_1.hashFile(event.file, "sha256", "hex"));
    const isMac = packager.platform === core_1.Platform.MAC;
    const createdFiles = new Set();
    const sharedInfo = await createUpdateInfo(version, event, await getReleaseInfo(packager));
    const tasks = [];
    const electronUpdaterCompatibility = packager.platformSpecificBuildOptions.electronUpdaterCompatibility || packager.config.electronUpdaterCompatibility || ">=2.15";
    for (const publishConfiguration of publishConfigs) {
        let dir = outDir;
        if (publishConfigs.length > 1 && publishConfiguration !== publishConfigs[0]) {
            dir = path.join(outDir, publishConfiguration.provider);
        }
        let isElectronUpdater1xCompatibility = computeIsisElectronUpdater1xCompatibility(electronUpdaterCompatibility, publishConfiguration, packager.info);
        let info = sharedInfo;
        // noinspection JSDeprecatedSymbols
        if (isElectronUpdater1xCompatibility && packager.platform === core_1.Platform.WINDOWS) {
            info = {
                ...info,
            };
            info.sha2 = await sha2.value;
        }
        if (event.safeArtifactName != null && publishConfiguration.provider === "github") {
            const newFiles = info.files.slice();
            newFiles[0].url = event.safeArtifactName;
            info = {
                ...info,
                files: newFiles,
                path: event.safeArtifactName,
            };
        }
        for (const channel of computeChannelNames(packager, publishConfiguration)) {
            if (isMac && isElectronUpdater1xCompatibility && event.file.endsWith(".zip")) {
                // write only for first channel (generateUpdatesFilesForAllChannels is a new functionality, no need to generate old mac update info file)
                isElectronUpdater1xCompatibility = false;
                await writeOldMacInfo(publishConfiguration, outDir, dir, channel, createdFiles, version, packager);
            }
            const updateInfoFile = path.join(dir, getUpdateInfoFileName(channel, packager, event.arch));
            if (createdFiles.has(updateInfoFile)) {
                continue;
            }
            createdFiles.add(updateInfoFile);
            // artifact should be uploaded only to designated publish provider
            tasks.push({
                file: updateInfoFile,
                info,
                publishConfiguration,
                packager,
            });
        }
    }
    return tasks;
}
exports.createUpdateInfoTasks = createUpdateInfoTasks;
async function createUpdateInfo(version, event, releaseInfo) {
    const customUpdateInfo = event.updateInfo;
    const url = path.basename(event.file);
    const sha512 = (customUpdateInfo == null ? null : customUpdateInfo.sha512) || (await hash_1.hashFile(event.file));
    const files = [{ url, sha512 }];
    const result = {
        // @ts-ignore
        version,
        // @ts-ignore
        files,
        // @ts-ignore
        path: url /* backward compatibility, electron-updater 1.x - electron-updater 2.15.0 */,
        // @ts-ignore
        sha512 /* backward compatibility, electron-updater 1.x - electron-updater 2.15.0 */,
        ...releaseInfo,
    };
    if (customUpdateInfo != null) {
        // file info or nsis web installer packages info
        Object.assign("sha512" in customUpdateInfo ? files[0] : result, customUpdateInfo);
    }
    return result;
}
async function writeUpdateInfoFiles(updateInfoFileTasks, packager) {
    // zip must be first and zip info must be used for old path/sha512 properties in the update info
    updateInfoFileTasks.sort((a, b) => (a.info.files[0].url.endsWith(".zip") ? 0 : 100) - (b.info.files[0].url.endsWith(".zip") ? 0 : 100));
    const updateChannelFileToInfo = new Map();
    for (const task of updateInfoFileTasks) {
        // https://github.com/electron-userland/electron-builder/pull/2994
        const key = `${task.file}@${builder_util_1.safeStringifyJson(task.publishConfiguration, new Set(["releaseType"]))}`;
        const existingTask = updateChannelFileToInfo.get(key);
        if (existingTask == null) {
            updateChannelFileToInfo.set(key, task);
            continue;
        }
        existingTask.info.files.push(...task.info.files);
    }
    const releaseDate = new Date().toISOString();
    await bluebird_lst_1.default.map(updateChannelFileToInfo.values(), async (task) => {
        const publishConfig = task.publishConfiguration;
        if (publishConfig.publishAutoUpdate === false) {
            builder_util_1.log.debug({
                provider: publishConfig.provider,
                reason: "publishAutoUpdate is set to false",
            }, "auto update metadata file not published");
            return;
        }
        if (task.info.releaseDate == null) {
            task.info.releaseDate = releaseDate;
        }
        const fileContent = Buffer.from(builder_util_1.serializeToYaml(task.info, false, true));
        await fs_extra_1.outputFile(task.file, fileContent);
        packager.dispatchArtifactCreated({
            file: task.file,
            fileContent,
            arch: null,
            packager: task.packager,
            target: null,
            publishConfig,
        });
    }, { concurrency: 4 });
}
exports.writeUpdateInfoFiles = writeUpdateInfoFiles;
// backward compatibility - write json file
async function writeOldMacInfo(publishConfig, outDir, dir, channel, createdFiles, version, packager) {
    const isGitHub = publishConfig.provider === "github";
    const updateInfoFile = isGitHub && outDir === dir ? path.join(dir, "github", `${channel}-mac.json`) : path.join(dir, `${channel}-mac.json`);
    if (!createdFiles.has(updateInfoFile)) {
        createdFiles.add(updateInfoFile);
        await fs_extra_1.outputJson(updateInfoFile, {
            version,
            releaseDate: new Date().toISOString(),
            url: PublishManager_1.computeDownloadUrl(publishConfig, packager.generateName2("zip", "mac", isGitHub), packager),
        }, { spaces: 2 });
        packager.info.dispatchArtifactCreated({
            file: updateInfoFile,
            arch: null,
            packager,
            target: null,
            publishConfig,
        });
    }
}
//# sourceMappingURL=updateInfoBuilder.js.map