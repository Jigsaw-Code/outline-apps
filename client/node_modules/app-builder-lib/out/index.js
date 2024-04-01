"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.build = exports.checkBuildRequestOptions = exports.buildForge = exports.PlatformPackager = exports.PublishManager = exports.CancellationToken = exports.AppInfo = exports.archFromString = exports.Arch = exports.getArchSuffix = exports.DEFAULT_TARGET = exports.DIR_TARGET = exports.Target = exports.Platform = exports.Packager = void 0;
const promise_1 = require("builder-util/out/promise");
const builder_util_1 = require("builder-util");
const builder_util_runtime_1 = require("builder-util-runtime");
const packager_1 = require("./packager");
const platformPackager_1 = require("./platformPackager");
const PublishManager_1 = require("./publish/PublishManager");
var packager_2 = require("./packager");
Object.defineProperty(exports, "Packager", { enumerable: true, get: function () { return packager_2.Packager; } });
var core_1 = require("./core");
Object.defineProperty(exports, "Platform", { enumerable: true, get: function () { return core_1.Platform; } });
Object.defineProperty(exports, "Target", { enumerable: true, get: function () { return core_1.Target; } });
Object.defineProperty(exports, "DIR_TARGET", { enumerable: true, get: function () { return core_1.DIR_TARGET; } });
Object.defineProperty(exports, "DEFAULT_TARGET", { enumerable: true, get: function () { return core_1.DEFAULT_TARGET; } });
var builder_util_2 = require("builder-util");
Object.defineProperty(exports, "getArchSuffix", { enumerable: true, get: function () { return builder_util_2.getArchSuffix; } });
Object.defineProperty(exports, "Arch", { enumerable: true, get: function () { return builder_util_2.Arch; } });
Object.defineProperty(exports, "archFromString", { enumerable: true, get: function () { return builder_util_2.archFromString; } });
var appInfo_1 = require("./appInfo");
Object.defineProperty(exports, "AppInfo", { enumerable: true, get: function () { return appInfo_1.AppInfo; } });
var builder_util_runtime_2 = require("builder-util-runtime");
Object.defineProperty(exports, "CancellationToken", { enumerable: true, get: function () { return builder_util_runtime_2.CancellationToken; } });
var PublishManager_2 = require("./publish/PublishManager");
Object.defineProperty(exports, "PublishManager", { enumerable: true, get: function () { return PublishManager_2.PublishManager; } });
var platformPackager_2 = require("./platformPackager");
Object.defineProperty(exports, "PlatformPackager", { enumerable: true, get: function () { return platformPackager_2.PlatformPackager; } });
var forge_maker_1 = require("./forge-maker");
Object.defineProperty(exports, "buildForge", { enumerable: true, get: function () { return forge_maker_1.buildForge; } });
const expectedOptions = new Set(["publish", "targets", "mac", "win", "linux", "projectDir", "platformPackagerFactory", "config", "effectiveOptionComputed", "prepackaged"]);
function checkBuildRequestOptions(options) {
    for (const optionName of Object.keys(options)) {
        if (!expectedOptions.has(optionName) && options[optionName] !== undefined) {
            throw new builder_util_1.InvalidConfigurationError(`Unknown option "${optionName}"`);
        }
    }
}
exports.checkBuildRequestOptions = checkBuildRequestOptions;
function build(options, packager = new packager_1.Packager(options)) {
    checkBuildRequestOptions(options);
    const publishManager = new PublishManager_1.PublishManager(packager, options);
    const sigIntHandler = () => {
        builder_util_1.log.warn("cancelled by SIGINT");
        packager.cancellationToken.cancel();
        publishManager.cancelTasks();
    };
    process.once("SIGINT", sigIntHandler);
    const promise = packager.build().then(async (buildResult) => {
        const afterAllArtifactBuild = platformPackager_1.resolveFunction(buildResult.configuration.afterAllArtifactBuild, "afterAllArtifactBuild");
        if (afterAllArtifactBuild != null) {
            const newArtifacts = builder_util_runtime_1.asArray(await Promise.resolve(afterAllArtifactBuild(buildResult)));
            if (newArtifacts.length === 0 || !publishManager.isPublish) {
                return buildResult.artifactPaths;
            }
            const publishConfigurations = await publishManager.getGlobalPublishConfigurations();
            if (publishConfigurations == null || publishConfigurations.length === 0) {
                return buildResult.artifactPaths;
            }
            for (const newArtifact of newArtifacts) {
                buildResult.artifactPaths.push(newArtifact);
                for (const publishConfiguration of publishConfigurations) {
                    publishManager.scheduleUpload(publishConfiguration, {
                        file: newArtifact,
                        arch: null,
                    }, packager.appInfo);
                }
            }
        }
        return buildResult.artifactPaths;
    });
    return promise_1.executeFinally(promise, isErrorOccurred => {
        let promise;
        if (isErrorOccurred) {
            publishManager.cancelTasks();
            promise = Promise.resolve(null);
        }
        else {
            promise = publishManager.awaitTasks();
        }
        return promise.then(() => process.removeListener("SIGINT", sigIntHandler));
    });
}
exports.build = build;
//# sourceMappingURL=index.js.map