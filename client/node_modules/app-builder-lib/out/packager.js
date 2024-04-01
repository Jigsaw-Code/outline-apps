"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Packager = void 0;
const builder_util_1 = require("builder-util");
const builder_util_runtime_1 = require("builder-util-runtime");
const promise_1 = require("builder-util/out/promise");
const events_1 = require("events");
const fs_extra_1 = require("fs-extra");
const isCI = require("is-ci");
const lazy_val_1 = require("lazy-val");
const path = require("path");
const arch_1 = require("builder-util/out/arch");
const appInfo_1 = require("./appInfo");
const asar_1 = require("./asar/asar");
const core_1 = require("./core");
const ElectronFramework_1 = require("./electron/ElectronFramework");
const LibUiFramework_1 = require("./frameworks/LibUiFramework");
const platformPackager_1 = require("./platformPackager");
const ProtonFramework_1 = require("./ProtonFramework");
const targetFactory_1 = require("./targets/targetFactory");
const config_1 = require("./util/config");
const macroExpander_1 = require("./util/macroExpander");
const packageDependencies_1 = require("./util/packageDependencies");
const packageMetadata_1 = require("./util/packageMetadata");
const repositoryInfo_1 = require("./util/repositoryInfo");
const yarn_1 = require("./util/yarn");
const version_1 = require("./version");
const os_1 = require("os");
function addHandler(emitter, event, handler) {
    emitter.on(event, handler);
}
async function createFrameworkInfo(configuration, packager) {
    let framework = configuration.framework;
    if (framework != null) {
        framework = framework.toLowerCase();
    }
    let nodeVersion = configuration.nodeVersion;
    if (framework === "electron" || framework == null) {
        return await ElectronFramework_1.createElectronFrameworkSupport(configuration, packager);
    }
    if (nodeVersion == null || nodeVersion === "current") {
        nodeVersion = process.versions.node;
    }
    const distMacOsName = `${packager.appInfo.productFilename}.app`;
    const isUseLaunchUi = configuration.launchUiVersion !== false;
    if (framework === "proton" || framework === "proton-native") {
        return new ProtonFramework_1.ProtonFramework(nodeVersion, distMacOsName, isUseLaunchUi);
    }
    else if (framework === "libui") {
        return new LibUiFramework_1.LibUiFramework(nodeVersion, distMacOsName, isUseLaunchUi);
    }
    else {
        throw new builder_util_1.InvalidConfigurationError(`Unknown framework: ${framework}`);
    }
}
class Packager {
    //noinspection JSUnusedGlobalSymbols
    constructor(options, cancellationToken = new builder_util_runtime_1.CancellationToken()) {
        this.cancellationToken = cancellationToken;
        this._metadata = null;
        this._nodeModulesHandledExternally = false;
        this._isPrepackedAppAsar = false;
        this._devMetadata = null;
        this._configuration = null;
        this.isTwoPackageJsonProjectLayoutUsed = false;
        this.eventEmitter = new events_1.EventEmitter();
        this._appInfo = null;
        this.tempDirManager = new builder_util_1.TmpDir("packager");
        this._repositoryInfo = new lazy_val_1.Lazy(() => repositoryInfo_1.getRepositoryInfo(this.projectDir, this.metadata, this.devMetadata));
        this.afterPackHandlers = [];
        this.debugLogger = new builder_util_1.DebugLogger(builder_util_1.log.isDebugEnabled);
        this.nodeDependencyInfo = new Map();
        this.stageDirPathCustomizer = (target, packager, arch) => {
            return path.join(target.outDir, `__${target.name}-${arch_1.getArtifactArchName(arch, target.name)}`);
        };
        this._buildResourcesDir = null;
        this._framework = null;
        this.toDispose = [];
        if ("devMetadata" in options) {
            throw new builder_util_1.InvalidConfigurationError("devMetadata in the options is deprecated, please use config instead");
        }
        if ("extraMetadata" in options) {
            throw new builder_util_1.InvalidConfigurationError("extraMetadata in the options is deprecated, please use config.extraMetadata instead");
        }
        const targets = options.targets || new Map();
        if (options.targets == null) {
            options.targets = targets;
        }
        function processTargets(platform, types) {
            function commonArch(currentIfNotSpecified) {
                const result = Array();
                return result.length === 0 && currentIfNotSpecified ? [builder_util_1.archFromString(process.arch)] : result;
            }
            let archToType = targets.get(platform);
            if (archToType == null) {
                archToType = new Map();
                targets.set(platform, archToType);
            }
            if (types.length === 0) {
                for (const arch of commonArch(false)) {
                    archToType.set(arch, []);
                }
                return;
            }
            for (const type of types) {
                const suffixPos = type.lastIndexOf(":");
                if (suffixPos > 0) {
                    builder_util_1.addValue(archToType, builder_util_1.archFromString(type.substring(suffixPos + 1)), type.substring(0, suffixPos));
                }
                else {
                    for (const arch of commonArch(true)) {
                        builder_util_1.addValue(archToType, arch, type);
                    }
                }
            }
        }
        if (options.mac != null) {
            processTargets(core_1.Platform.MAC, options.mac);
        }
        if (options.linux != null) {
            processTargets(core_1.Platform.LINUX, options.linux);
        }
        if (options.win != null) {
            processTargets(core_1.Platform.WINDOWS, options.win);
        }
        this.projectDir = options.projectDir == null ? process.cwd() : path.resolve(options.projectDir);
        this._appDir = this.projectDir;
        this.options = {
            ...options,
            prepackaged: options.prepackaged == null ? null : path.resolve(this.projectDir, options.prepackaged),
        };
        try {
            builder_util_1.log.info({ version: version_1.PACKAGE_VERSION, os: os_1.release() }, "electron-builder");
        }
        catch (e) {
            // error in dev mode without babel
            if (!(e instanceof ReferenceError)) {
                throw e;
            }
        }
    }
    get appDir() {
        return this._appDir;
    }
    get metadata() {
        return this._metadata;
    }
    get areNodeModulesHandledExternally() {
        return this._nodeModulesHandledExternally;
    }
    get isPrepackedAppAsar() {
        return this._isPrepackedAppAsar;
    }
    get devMetadata() {
        return this._devMetadata;
    }
    get config() {
        return this._configuration;
    }
    get appInfo() {
        return this._appInfo;
    }
    get repositoryInfo() {
        return this._repositoryInfo.value;
    }
    getNodeDependencyInfo(platform) {
        let key = "";
        let excludedDependencies = null;
        if (platform != null && this.framework.getExcludedDependencies != null) {
            excludedDependencies = this.framework.getExcludedDependencies(platform);
            if (excludedDependencies != null) {
                key += `-${platform.name}`;
            }
        }
        let result = this.nodeDependencyInfo.get(key);
        if (result == null) {
            result = packageDependencies_1.createLazyProductionDeps(this.appDir, excludedDependencies);
            this.nodeDependencyInfo.set(key, result);
        }
        return result;
    }
    get buildResourcesDir() {
        let result = this._buildResourcesDir;
        if (result == null) {
            result = path.resolve(this.projectDir, this.relativeBuildResourcesDirname);
            this._buildResourcesDir = result;
        }
        return result;
    }
    get relativeBuildResourcesDirname() {
        return this.config.directories.buildResources;
    }
    get framework() {
        return this._framework;
    }
    disposeOnBuildFinish(disposer) {
        this.toDispose.push(disposer);
    }
    addAfterPackHandler(handler) {
        this.afterPackHandlers.push(handler);
    }
    artifactCreated(handler) {
        addHandler(this.eventEmitter, "artifactCreated", handler);
        return this;
    }
    async callArtifactBuildStarted(event, logFields) {
        builder_util_1.log.info(logFields || {
            target: event.targetPresentableName,
            arch: event.arch == null ? null : builder_util_1.Arch[event.arch],
            file: builder_util_1.log.filePath(event.file),
        }, "building");
        const handler = platformPackager_1.resolveFunction(this.config.artifactBuildStarted, "artifactBuildStarted");
        if (handler != null) {
            await Promise.resolve(handler(event));
        }
    }
    /**
     * Only for sub artifacts (update info), for main artifacts use `callArtifactBuildCompleted`.
     */
    dispatchArtifactCreated(event) {
        this.eventEmitter.emit("artifactCreated", event);
    }
    async callArtifactBuildCompleted(event) {
        const handler = platformPackager_1.resolveFunction(this.config.artifactBuildCompleted, "artifactBuildCompleted");
        if (handler != null) {
            await Promise.resolve(handler(event));
        }
        this.dispatchArtifactCreated(event);
    }
    async callAppxManifestCreated(path) {
        const handler = platformPackager_1.resolveFunction(this.config.appxManifestCreated, "appxManifestCreated");
        if (handler != null) {
            await Promise.resolve(handler(path));
        }
    }
    async callMsiProjectCreated(path) {
        const handler = platformPackager_1.resolveFunction(this.config.msiProjectCreated, "msiProjectCreated");
        if (handler != null) {
            await Promise.resolve(handler(path));
        }
    }
    async build() {
        let configPath = null;
        let configFromOptions = this.options.config;
        if (typeof configFromOptions === "string") {
            // it is a path to config file
            configPath = configFromOptions;
            configFromOptions = null;
        }
        else if (configFromOptions != null && typeof configFromOptions.extends === "string" && configFromOptions.extends.includes(".")) {
            configPath = configFromOptions.extends;
            delete configFromOptions.extends;
        }
        const projectDir = this.projectDir;
        const devPackageFile = path.join(projectDir, "package.json");
        this._devMetadata = await promise_1.orNullIfFileNotExist(packageMetadata_1.readPackageJson(devPackageFile));
        const devMetadata = this.devMetadata;
        const configuration = await config_1.getConfig(projectDir, configPath, configFromOptions, new lazy_val_1.Lazy(() => Promise.resolve(devMetadata)));
        if (builder_util_1.log.isDebugEnabled) {
            builder_util_1.log.debug({ config: getSafeEffectiveConfig(configuration) }, "effective config");
        }
        this._appDir = await config_1.computeDefaultAppDirectory(projectDir, configuration.directories.app);
        this.isTwoPackageJsonProjectLayoutUsed = this._appDir !== projectDir;
        const appPackageFile = this.isTwoPackageJsonProjectLayoutUsed ? path.join(this.appDir, "package.json") : devPackageFile;
        // tslint:disable:prefer-conditional-expression
        if (this.devMetadata != null && !this.isTwoPackageJsonProjectLayoutUsed) {
            this._metadata = this.devMetadata;
        }
        else {
            this._metadata = await this.readProjectMetadataIfTwoPackageStructureOrPrepacked(appPackageFile);
        }
        builder_util_1.deepAssign(this.metadata, configuration.extraMetadata);
        if (this.isTwoPackageJsonProjectLayoutUsed) {
            builder_util_1.log.debug({ devPackageFile, appPackageFile }, "two package.json structure is used");
        }
        packageMetadata_1.checkMetadata(this.metadata, this.devMetadata, appPackageFile, devPackageFile);
        return await this._build(configuration, this._metadata, this._devMetadata);
    }
    // external caller of this method always uses isTwoPackageJsonProjectLayoutUsed=false and appDir=projectDir, no way (and need) to use another values
    async _build(configuration, metadata, devMetadata, repositoryInfo) {
        await config_1.validateConfig(configuration, this.debugLogger);
        this._configuration = configuration;
        this._metadata = metadata;
        this._devMetadata = devMetadata;
        if (repositoryInfo != null) {
            this._repositoryInfo.value = Promise.resolve(repositoryInfo);
        }
        this._appInfo = new appInfo_1.AppInfo(this, null);
        this._framework = await createFrameworkInfo(this.config, this);
        const commonOutDirWithoutPossibleOsMacro = path.resolve(this.projectDir, macroExpander_1.expandMacro(configuration.directories.output, null, this._appInfo, {
            os: "",
        }));
        if (!isCI && process.stdout.isTTY) {
            const effectiveConfigFile = path.join(commonOutDirWithoutPossibleOsMacro, "builder-effective-config.yaml");
            builder_util_1.log.info({ file: builder_util_1.log.filePath(effectiveConfigFile) }, "writing effective config");
            await fs_extra_1.outputFile(effectiveConfigFile, getSafeEffectiveConfig(configuration));
        }
        // because artifact event maybe dispatched several times for different publish providers
        const artifactPaths = new Set();
        this.artifactCreated(event => {
            if (event.file != null) {
                artifactPaths.add(event.file);
            }
        });
        this.disposeOnBuildFinish(() => this.tempDirManager.cleanup());
        const platformToTargets = await promise_1.executeFinally(this.doBuild(), async () => {
            if (this.debugLogger.isEnabled) {
                await this.debugLogger.save(path.join(commonOutDirWithoutPossibleOsMacro, "builder-debug.yml"));
            }
            const toDispose = this.toDispose.slice();
            this.toDispose.length = 0;
            for (const disposer of toDispose) {
                await disposer().catch(e => {
                    builder_util_1.log.warn({ error: e }, "cannot dispose");
                });
            }
        });
        return {
            outDir: commonOutDirWithoutPossibleOsMacro,
            artifactPaths: Array.from(artifactPaths),
            platformToTargets,
            configuration,
        };
    }
    async readProjectMetadataIfTwoPackageStructureOrPrepacked(appPackageFile) {
        let data = await promise_1.orNullIfFileNotExist(packageMetadata_1.readPackageJson(appPackageFile));
        if (data != null) {
            return data;
        }
        data = await promise_1.orNullIfFileNotExist(asar_1.readAsarJson(path.join(this.projectDir, "app.asar"), "package.json"));
        if (data != null) {
            this._isPrepackedAppAsar = true;
            return data;
        }
        throw new Error(`Cannot find package.json in the ${path.dirname(appPackageFile)}`);
    }
    async doBuild() {
        const taskManager = new builder_util_1.AsyncTaskManager(this.cancellationToken);
        const platformToTarget = new Map();
        const createdOutDirs = new Set();
        for (const [platform, archToType] of this.options.targets) {
            if (this.cancellationToken.cancelled) {
                break;
            }
            if (platform === core_1.Platform.MAC && process.platform === core_1.Platform.WINDOWS.nodeName) {
                throw new builder_util_1.InvalidConfigurationError("Build for macOS is supported only on macOS, please see https://electron.build/multi-platform-build");
            }
            const packager = await this.createHelper(platform);
            const nameToTarget = new Map();
            platformToTarget.set(platform, nameToTarget);
            for (const [arch, targetNames] of targetFactory_1.computeArchToTargetNamesMap(archToType, packager, platform)) {
                if (this.cancellationToken.cancelled) {
                    break;
                }
                // support os and arch macro in output value
                const outDir = path.resolve(this.projectDir, packager.expandMacro(this._configuration.directories.output, builder_util_1.Arch[arch]));
                const targetList = targetFactory_1.createTargets(nameToTarget, targetNames.length === 0 ? packager.defaultTarget : targetNames, outDir, packager);
                await createOutDirIfNeed(targetList, createdOutDirs);
                await packager.pack(outDir, arch, targetList, taskManager);
            }
            if (this.cancellationToken.cancelled) {
                break;
            }
            for (const target of nameToTarget.values()) {
                taskManager.addTask(target.finishBuild());
            }
        }
        await taskManager.awaitTasks();
        return platformToTarget;
    }
    async createHelper(platform) {
        if (this.options.platformPackagerFactory != null) {
            return this.options.platformPackagerFactory(this, platform);
        }
        switch (platform) {
            case core_1.Platform.MAC: {
                const helperClass = (await Promise.resolve().then(() => require("./macPackager"))).default;
                return new helperClass(this);
            }
            case core_1.Platform.WINDOWS: {
                const helperClass = (await Promise.resolve().then(() => require("./winPackager"))).WinPackager;
                return new helperClass(this);
            }
            case core_1.Platform.LINUX:
                return new (await Promise.resolve().then(() => require("./linuxPackager"))).LinuxPackager(this);
            default:
                throw new Error(`Unknown platform: ${platform}`);
        }
    }
    async installAppDependencies(platform, arch) {
        if (this.options.prepackaged != null || !this.framework.isNpmRebuildRequired) {
            return;
        }
        const frameworkInfo = { version: this.framework.version, useCustomDist: true };
        const config = this.config;
        if (config.nodeGypRebuild === true) {
            await yarn_1.nodeGypRebuild(platform.nodeName, builder_util_1.Arch[arch], frameworkInfo);
        }
        if (config.npmRebuild === false) {
            builder_util_1.log.info({ reason: "npmRebuild is set to false" }, "skipped dependencies rebuild");
            return;
        }
        const beforeBuild = platformPackager_1.resolveFunction(config.beforeBuild, "beforeBuild");
        if (beforeBuild != null) {
            const performDependenciesInstallOrRebuild = await beforeBuild({
                appDir: this.appDir,
                electronVersion: this.config.electronVersion,
                platform,
                arch: builder_util_1.Arch[arch],
            });
            // If beforeBuild resolves to false, it means that handling node_modules is done outside of electron-builder.
            this._nodeModulesHandledExternally = !performDependenciesInstallOrRebuild;
            if (!performDependenciesInstallOrRebuild) {
                return;
            }
        }
        if (config.buildDependenciesFromSource === true && platform.nodeName !== process.platform) {
            builder_util_1.log.info({ reason: "platform is different and buildDependenciesFromSource is set to true" }, "skipped dependencies rebuild");
        }
        else {
            await yarn_1.installOrRebuild(config, this.appDir, {
                frameworkInfo,
                platform: platform.nodeName,
                arch: builder_util_1.Arch[arch],
                productionDeps: this.getNodeDependencyInfo(null),
            });
        }
    }
    async afterPack(context) {
        const afterPack = platformPackager_1.resolveFunction(this.config.afterPack, "afterPack");
        const handlers = this.afterPackHandlers.slice();
        if (afterPack != null) {
            // user handler should be last
            handlers.push(afterPack);
        }
        for (const handler of handlers) {
            await Promise.resolve(handler(context));
        }
    }
}
exports.Packager = Packager;
function createOutDirIfNeed(targetList, createdOutDirs) {
    const ourDirs = new Set();
    for (const target of targetList) {
        // noinspection SuspiciousInstanceOfGuard
        if (target instanceof targetFactory_1.NoOpTarget) {
            continue;
        }
        const outDir = target.outDir;
        if (!createdOutDirs.has(outDir)) {
            ourDirs.add(outDir);
        }
    }
    if (ourDirs.size === 0) {
        return Promise.resolve();
    }
    return Promise.all(Array.from(ourDirs)
        .sort()
        .map(dir => {
        return fs_extra_1.mkdirs(dir)
            .then(() => fs_extra_1.chmod(dir, 0o755) /* set explicitly */)
            .then(() => createdOutDirs.add(dir));
    }));
}
function getSafeEffectiveConfig(configuration) {
    const o = JSON.parse(builder_util_1.safeStringifyJson(configuration));
    if (o.cscLink != null) {
        o.cscLink = "<hidden by builder>";
    }
    return builder_util_1.serializeToYaml(o, true);
}
//# sourceMappingURL=packager.js.map