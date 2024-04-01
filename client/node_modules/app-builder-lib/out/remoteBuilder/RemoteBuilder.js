"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoteBuilder = void 0;
const bluebird_lst_1 = require("bluebird-lst");
const builder_util_1 = require("builder-util");
const path = require("path");
const core_1 = require("../core");
const platformPackager_1 = require("../platformPackager");
const appBuilder_1 = require("../util/appBuilder");
const ProjectInfoManager_1 = require("./ProjectInfoManager");
class RemoteBuilder {
    constructor(packager) {
        this.packager = packager;
        this.toBuild = new Map();
        this.buildStarted = false;
    }
    scheduleBuild(target, arch, unpackedDirectory) {
        if (!builder_util_1.isEnvTrue(process.env._REMOTE_BUILD) && this.packager.config.remoteBuild === false) {
            throw new builder_util_1.InvalidConfigurationError('Target is not supported on your OS and using of Electron Build Service is disabled ("remoteBuild" option)');
        }
        let list = this.toBuild.get(arch);
        if (list == null) {
            list = [];
            this.toBuild.set(arch, list);
        }
        list.push({
            name: target.name,
            arch: builder_util_1.Arch[arch],
            unpackedDirectory,
            outDir: target.outDir,
        });
    }
    build() {
        if (this.buildStarted) {
            return Promise.resolve();
        }
        this.buildStarted = true;
        return bluebird_lst_1.default.mapSeries(Array.from(this.toBuild.keys()), (arch) => {
            return this._build(this.toBuild.get(arch), this.packager);
        });
    }
    // noinspection JSMethodCanBeStatic
    async _build(targets, packager) {
        if (builder_util_1.log.isDebugEnabled) {
            builder_util_1.log.debug({ remoteTargets: JSON.stringify(targets, null, 2) }, "remote building");
        }
        const projectInfoManager = new ProjectInfoManager_1.ProjectInfoManager(packager.info);
        const buildRequest = {
            targets: targets.map(it => {
                return {
                    name: it.name,
                    arch: it.arch,
                    unpackedDirName: path.basename(it.unpackedDirectory),
                };
            }),
            platform: packager.platform.buildConfigurationKey,
        };
        if (platformPackager_1.isSafeToUnpackElectronOnRemoteBuildServer(packager)) {
            buildRequest.electronDownload = {
                version: packager.info.framework.version,
                platform: core_1.Platform.LINUX.nodeName,
                arch: targets[0].arch,
            };
            const linuxPackager = packager;
            buildRequest.executableName = linuxPackager.executableName;
        }
        const req = Buffer.from(JSON.stringify(buildRequest)).toString("base64");
        const outDir = targets[0].outDir;
        const args = ["remote-build", "--request", req, "--output", outDir];
        args.push("--file", targets[0].unpackedDirectory);
        args.push("--file", await projectInfoManager.infoFile.value);
        const buildResourcesDir = packager.buildResourcesDir;
        if (buildResourcesDir === packager.projectDir) {
            throw new builder_util_1.InvalidConfigurationError(`Build resources dir equals to project dir and so, not sent to remote build agent. It will lead to incorrect results.\nPlease set "directories.buildResources" to separate dir or leave default ("build" directory in the project root)`);
        }
        args.push("--build-resource-dir", buildResourcesDir);
        const result = await appBuilder_1.executeAppBuilderAsJson(args);
        if (result.error != null) {
            throw new builder_util_1.InvalidConfigurationError(`Remote builder error (if you think that it is not your application misconfiguration issue, please file issue to https://github.com/electron-userland/electron-builder/issues):\n\n${result.error}`, "REMOTE_BUILDER_ERROR");
        }
        else if (result.files != null) {
            for (const artifact of result.files) {
                const localFile = path.join(outDir, artifact.file);
                const artifactCreatedEvent = this.artifactInfoToArtifactCreatedEvent(artifact, localFile, outDir);
                // PublishManager uses outDir and options, real (the same as for local build) values must be used
                await this.packager.info.callArtifactBuildCompleted(artifactCreatedEvent);
            }
        }
    }
    artifactInfoToArtifactCreatedEvent(artifact, localFile, outDir) {
        const target = artifact.target;
        // noinspection SpellCheckingInspection
        return {
            ...artifact,
            file: localFile,
            target: target == null ? null : new FakeTarget(target, outDir, this.packager.config[target]),
            packager: this.packager,
        };
    }
}
exports.RemoteBuilder = RemoteBuilder;
class FakeTarget extends core_1.Target {
    constructor(name, outDir, options) {
        super(name);
        this.outDir = outDir;
        this.options = options;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async build(appOutDir, arch) {
        // no build
    }
}
//# sourceMappingURL=RemoteBuilder.js.map