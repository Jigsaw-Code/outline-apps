"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSafeToUnpackElectronOnRemoteBuildServer = exports.chooseNotNull = exports.resolveFunction = exports.normalizeExt = exports.computeSafeArtifactNameIfNeeded = exports.isSafeGithubName = exports.PlatformPackager = void 0;
const bluebird_lst_1 = require("bluebird-lst");
const builder_util_1 = require("builder-util");
const arch_1 = require("builder-util/out/arch");
const fs_1 = require("builder-util/out/fs");
const promise_1 = require("builder-util/out/promise");
const promises_1 = require("fs/promises");
const lazy_val_1 = require("lazy-val");
const path = require("path");
const appInfo_1 = require("./appInfo");
const asarFileChecker_1 = require("./asar/asarFileChecker");
const asarUtil_1 = require("./asar/asarUtil");
const integrity_1 = require("./asar/integrity");
const fileMatcher_1 = require("./fileMatcher");
const fileTransformer_1 = require("./fileTransformer");
const Framework_1 = require("./Framework");
const index_1 = require("./index");
const appBuilder_1 = require("./util/appBuilder");
const appFileCopier_1 = require("./util/appFileCopier");
const macroExpander_1 = require("./util/macroExpander");
class PlatformPackager {
    constructor(info, platform) {
        this.info = info;
        this.platform = platform;
        this._resourceList = new lazy_val_1.Lazy(() => promise_1.orIfFileNotExist(promises_1.readdir(this.info.buildResourcesDir), []));
        this.platformSpecificBuildOptions = PlatformPackager.normalizePlatformSpecificBuildOptions(this.config[platform.buildConfigurationKey]);
        this.appInfo = this.prepareAppInfo(info.appInfo);
    }
    get packagerOptions() {
        return this.info.options;
    }
    get buildResourcesDir() {
        return this.info.buildResourcesDir;
    }
    get projectDir() {
        return this.info.projectDir;
    }
    get config() {
        return this.info.config;
    }
    get resourceList() {
        return this._resourceList.value;
    }
    get compression() {
        const compression = this.platformSpecificBuildOptions.compression;
        // explicitly set to null - request to use default value instead of parent (in the config)
        if (compression === null) {
            return "normal";
        }
        return compression || this.config.compression || "normal";
    }
    get debugLogger() {
        return this.info.debugLogger;
    }
    // eslint-disable-next-line
    prepareAppInfo(appInfo) {
        return new appInfo_1.AppInfo(this.info, null, this.platformSpecificBuildOptions);
    }
    static normalizePlatformSpecificBuildOptions(options) {
        return options == null ? Object.create(null) : options;
    }
    getCscPassword() {
        const password = this.doGetCscPassword();
        if (builder_util_1.isEmptyOrSpaces(password)) {
            builder_util_1.log.info({ reason: "CSC_KEY_PASSWORD is not defined" }, "empty password will be used for code signing");
            return "";
        }
        else {
            return password.trim();
        }
    }
    getCscLink(extraEnvName) {
        // allow to specify as empty string
        const envValue = chooseNotNull(extraEnvName == null ? null : process.env[extraEnvName], process.env.CSC_LINK);
        return chooseNotNull(chooseNotNull(this.info.config.cscLink, this.platformSpecificBuildOptions.cscLink), envValue);
    }
    doGetCscPassword() {
        // allow to specify as empty string
        return chooseNotNull(chooseNotNull(this.info.config.cscKeyPassword, this.platformSpecificBuildOptions.cscKeyPassword), process.env.CSC_KEY_PASSWORD);
    }
    computeAppOutDir(outDir, arch) {
        return (this.packagerOptions.prepackaged ||
            path.join(outDir, `${this.platform.buildConfigurationKey}${builder_util_1.getArchSuffix(arch, this.platformSpecificBuildOptions.defaultArch)}${this.platform === index_1.Platform.MAC ? "" : "-unpacked"}`));
    }
    dispatchArtifactCreated(file, target, arch, safeArtifactName) {
        return this.info.callArtifactBuildCompleted({
            file,
            safeArtifactName,
            target,
            arch,
            packager: this,
        });
    }
    async pack(outDir, arch, targets, taskManager) {
        const appOutDir = this.computeAppOutDir(outDir, arch);
        await this.doPack(outDir, appOutDir, this.platform.nodeName, arch, this.platformSpecificBuildOptions, targets);
        this.packageInDistributableFormat(appOutDir, arch, targets, taskManager);
    }
    packageInDistributableFormat(appOutDir, arch, targets, taskManager) {
        if (targets.find(it => !it.isAsyncSupported) == null) {
            PlatformPackager.buildAsyncTargets(targets, taskManager, appOutDir, arch);
            return;
        }
        taskManager.add(async () => {
            // BluebirdPromise.map doesn't invoke target.build immediately, but for RemoteTarget it is very critical to call build() before finishBuild()
            const subTaskManager = new builder_util_1.AsyncTaskManager(this.info.cancellationToken);
            PlatformPackager.buildAsyncTargets(targets, subTaskManager, appOutDir, arch);
            await subTaskManager.awaitTasks();
            for (const target of targets) {
                if (!target.isAsyncSupported) {
                    await target.build(appOutDir, arch);
                }
            }
        });
    }
    static buildAsyncTargets(targets, taskManager, appOutDir, arch) {
        for (const target of targets) {
            if (target.isAsyncSupported) {
                taskManager.addTask(target.build(appOutDir, arch));
            }
        }
    }
    getExtraFileMatchers(isResources, appOutDir, options) {
        const base = isResources
            ? this.getResourcesDir(appOutDir)
            : this.platform === index_1.Platform.MAC
                ? path.join(appOutDir, `${this.appInfo.productFilename}.app`, "Contents")
                : appOutDir;
        return fileMatcher_1.getFileMatchers(this.config, isResources ? "extraResources" : "extraFiles", base, options);
    }
    createGetFileMatchersOptions(outDir, arch, customBuildOptions) {
        return {
            macroExpander: it => this.expandMacro(it, arch == null ? null : builder_util_1.Arch[arch], { "/*": "{,/**/*}" }),
            customBuildOptions,
            globalOutDir: outDir,
            defaultSrc: this.projectDir,
        };
    }
    async doPack(outDir, appOutDir, platformName, arch, platformSpecificBuildOptions, targets, sign = true, disableAsarIntegrity = false) {
        if (this.packagerOptions.prepackaged != null) {
            return;
        }
        if (this.info.cancellationToken.cancelled) {
            return;
        }
        const beforePack = resolveFunction(this.config.beforePack, "beforePack");
        if (beforePack != null) {
            await beforePack({
                appOutDir,
                outDir,
                arch,
                targets,
                packager: this,
                electronPlatformName: platformName,
            });
        }
        await this.info.installAppDependencies(this.platform, arch);
        if (this.info.cancellationToken.cancelled) {
            return;
        }
        const framework = this.info.framework;
        builder_util_1.log.info({
            platform: platformName,
            arch: builder_util_1.Arch[arch],
            [`${framework.name}`]: framework.version,
            appOutDir: builder_util_1.log.filePath(appOutDir),
        }, `packaging`);
        await framework.prepareApplicationStageDirectory({
            packager: this,
            appOutDir,
            platformName,
            arch: builder_util_1.Arch[arch],
            version: framework.version,
        });
        const excludePatterns = [];
        const computeParsedPatterns = (patterns) => {
            if (patterns != null) {
                for (const pattern of patterns) {
                    pattern.computeParsedPatterns(excludePatterns, this.info.projectDir);
                }
            }
        };
        const getFileMatchersOptions = this.createGetFileMatchersOptions(outDir, arch, platformSpecificBuildOptions);
        const macroExpander = getFileMatchersOptions.macroExpander;
        const extraResourceMatchers = this.getExtraFileMatchers(true, appOutDir, getFileMatchersOptions);
        computeParsedPatterns(extraResourceMatchers);
        const extraFileMatchers = this.getExtraFileMatchers(false, appOutDir, getFileMatchersOptions);
        computeParsedPatterns(extraFileMatchers);
        const packContext = {
            appOutDir,
            outDir,
            arch,
            targets,
            packager: this,
            electronPlatformName: platformName,
        };
        const asarOptions = await this.computeAsarOptions(platformSpecificBuildOptions);
        const resourcesPath = this.platform === index_1.Platform.MAC
            ? path.join(appOutDir, framework.distMacOsAppName, "Contents", "Resources")
            : Framework_1.isElectronBased(framework)
                ? path.join(appOutDir, "resources")
                : appOutDir;
        const taskManager = new builder_util_1.AsyncTaskManager(this.info.cancellationToken);
        this.copyAppFiles(taskManager, asarOptions, resourcesPath, path.join(resourcesPath, "app"), packContext, platformSpecificBuildOptions, excludePatterns, macroExpander);
        await taskManager.awaitTasks();
        if (this.info.cancellationToken.cancelled) {
            return;
        }
        if (framework.beforeCopyExtraFiles != null) {
            const resourcesRelativePath = this.platform === index_1.Platform.MAC ? "Resources" : Framework_1.isElectronBased(framework) ? "resources" : "";
            await framework.beforeCopyExtraFiles({
                packager: this,
                appOutDir,
                asarIntegrity: asarOptions == null || disableAsarIntegrity ? null : await integrity_1.computeData({ resourcesPath, resourcesRelativePath }),
                platformName,
            });
        }
        if (this.info.cancellationToken.cancelled) {
            return;
        }
        const transformerForExtraFiles = this.createTransformerForExtraFiles(packContext);
        await fileMatcher_1.copyFiles(extraResourceMatchers, transformerForExtraFiles);
        await fileMatcher_1.copyFiles(extraFileMatchers, transformerForExtraFiles);
        if (this.info.cancellationToken.cancelled) {
            return;
        }
        await this.info.afterPack(packContext);
        if (framework.afterPack != null) {
            await framework.afterPack(packContext);
        }
        const isAsar = asarOptions != null;
        await this.sanityCheckPackage(appOutDir, isAsar, framework);
        if (sign) {
            await this.doSignAfterPack(outDir, appOutDir, platformName, arch, platformSpecificBuildOptions, targets);
        }
    }
    async doSignAfterPack(outDir, appOutDir, platformName, arch, platformSpecificBuildOptions, targets) {
        const asarOptions = await this.computeAsarOptions(platformSpecificBuildOptions);
        const isAsar = asarOptions != null;
        const packContext = {
            appOutDir,
            outDir,
            arch,
            targets,
            packager: this,
            electronPlatformName: platformName,
        };
        await this.signApp(packContext, isAsar);
        const afterSign = resolveFunction(this.config.afterSign, "afterSign");
        if (afterSign != null) {
            await Promise.resolve(afterSign(packContext));
        }
    }
    // eslint-disable-next-line
    createTransformerForExtraFiles(packContext) {
        return null;
    }
    copyAppFiles(taskManager, asarOptions, resourcePath, defaultDestination, packContext, platformSpecificBuildOptions, excludePatterns, macroExpander) {
        const appDir = this.info.appDir;
        const config = this.config;
        const isElectronCompile = asarOptions != null && fileTransformer_1.isElectronCompileUsed(this.info);
        const mainMatchers = fileMatcher_1.getMainFileMatchers(appDir, defaultDestination, macroExpander, platformSpecificBuildOptions, this, packContext.outDir, isElectronCompile);
        if (excludePatterns.length > 0) {
            for (const matcher of mainMatchers) {
                matcher.excludePatterns = excludePatterns;
            }
        }
        const framework = this.info.framework;
        const transformer = fileTransformer_1.createTransformer(appDir, config, isElectronCompile
            ? {
                originalMain: this.info.metadata.main,
                main: appFileCopier_1.ELECTRON_COMPILE_SHIM_FILENAME,
                ...config.extraMetadata,
            }
            : config.extraMetadata, framework.createTransformer == null ? null : framework.createTransformer());
        const _computeFileSets = (matchers) => {
            return appFileCopier_1.computeFileSets(matchers, this.info.isPrepackedAppAsar ? null : transformer, this, isElectronCompile).then(async (result) => {
                if (!this.info.isPrepackedAppAsar && !this.info.areNodeModulesHandledExternally) {
                    const moduleFileMatcher = fileMatcher_1.getNodeModuleFileMatcher(appDir, defaultDestination, macroExpander, platformSpecificBuildOptions, this.info);
                    result = result.concat(await appFileCopier_1.computeNodeModuleFileSets(this, moduleFileMatcher));
                }
                return result.filter(it => it.files.length > 0);
            });
        };
        if (this.info.isPrepackedAppAsar) {
            taskManager.addTask(bluebird_lst_1.default.each(_computeFileSets([new fileMatcher_1.FileMatcher(appDir, resourcePath, macroExpander)]), it => appFileCopier_1.copyAppFiles(it, this.info, transformer)));
        }
        else if (asarOptions == null) {
            // for ASAR all asar unpacked files will be extra transformed (e.g. sign of EXE and DLL) later,
            // for prepackaged asar extra transformation not supported yet,
            // so, extra transform if asar is disabled
            const transformerForExtraFiles = this.createTransformerForExtraFiles(packContext);
            const combinedTransformer = file => {
                if (transformerForExtraFiles != null) {
                    const result = transformerForExtraFiles(file);
                    if (result != null) {
                        return result;
                    }
                }
                return transformer(file);
            };
            taskManager.addTask(bluebird_lst_1.default.each(_computeFileSets(mainMatchers), it => appFileCopier_1.copyAppFiles(it, this.info, combinedTransformer)));
        }
        else {
            const unpackPattern = fileMatcher_1.getFileMatchers(config, "asarUnpack", defaultDestination, {
                macroExpander,
                customBuildOptions: platformSpecificBuildOptions,
                globalOutDir: packContext.outDir,
                defaultSrc: appDir,
            });
            const fileMatcher = unpackPattern == null ? null : unpackPattern[0];
            taskManager.addTask(_computeFileSets(mainMatchers).then(async (fileSets) => {
                for (const fileSet of fileSets) {
                    await appFileCopier_1.transformFiles(transformer, fileSet);
                }
                await new asarUtil_1.AsarPackager(appDir, resourcePath, asarOptions, fileMatcher == null ? null : fileMatcher.createFilter()).pack(fileSets, this);
            }));
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    signApp(packContext, isAsar) {
        return Promise.resolve();
    }
    getIconPath() {
        return Promise.resolve(null);
    }
    async computeAsarOptions(customBuildOptions) {
        if (!Framework_1.isElectronBased(this.info.framework)) {
            return null;
        }
        function errorMessage(name) {
            return `${name} is deprecated is deprecated and not supported — please use asarUnpack`;
        }
        const buildMetadata = this.config;
        if (buildMetadata["asar-unpack"] != null) {
            throw new Error(errorMessage("asar-unpack"));
        }
        if (buildMetadata["asar-unpack-dir"] != null) {
            throw new Error(errorMessage("asar-unpack-dir"));
        }
        const platformSpecific = customBuildOptions.asar;
        const result = platformSpecific == null ? this.config.asar : platformSpecific;
        if (result === false) {
            const appAsarStat = await fs_1.statOrNull(path.join(this.info.appDir, "app.asar"));
            //noinspection ES6MissingAwait
            if (appAsarStat == null || !appAsarStat.isFile()) {
                builder_util_1.log.warn({
                    solution: "enable asar and use asarUnpack to unpack files that must be externally available",
                }, "asar usage is disabled — this is strongly not recommended");
            }
            return null;
        }
        if (result == null || result === true) {
            return {};
        }
        for (const name of ["unpackDir", "unpack"]) {
            if (result[name] != null) {
                throw new Error(errorMessage(`asar.${name}`));
            }
        }
        return builder_util_1.deepAssign({}, result);
    }
    getElectronSrcDir(dist) {
        return path.resolve(this.projectDir, dist);
    }
    getElectronDestinationDir(appOutDir) {
        return appOutDir;
    }
    getResourcesDir(appOutDir) {
        if (this.platform === index_1.Platform.MAC) {
            return this.getMacOsResourcesDir(appOutDir);
        }
        else if (Framework_1.isElectronBased(this.info.framework)) {
            return path.join(appOutDir, "resources");
        }
        else {
            return appOutDir;
        }
    }
    getMacOsResourcesDir(appOutDir) {
        return path.join(appOutDir, `${this.appInfo.productFilename}.app`, "Contents", "Resources");
    }
    async checkFileInPackage(resourcesDir, file, messagePrefix, isAsar) {
        const relativeFile = path.relative(this.info.appDir, path.resolve(this.info.appDir, file));
        if (isAsar) {
            await asarFileChecker_1.checkFileInArchive(path.join(resourcesDir, "app.asar"), relativeFile, messagePrefix);
            return;
        }
        const pathParsed = path.parse(file);
        // Even when packaging to asar is disabled, it does not imply that the main file can not be inside an .asar archive.
        // This may occur when the packaging is done manually before processing with electron-builder.
        if (pathParsed.dir.includes(".asar")) {
            // The path needs to be split to the part with an asar archive which acts like a directory and the part with
            // the path to main file itself. (e.g. path/arch.asar/dir/index.js -> path/arch.asar, dir/index.js)
            // noinspection TypeScriptValidateJSTypes
            const pathSplit = pathParsed.dir.split(path.sep);
            let partWithAsarIndex = 0;
            pathSplit.some((pathPart, index) => {
                partWithAsarIndex = index;
                return pathPart.endsWith(".asar");
            });
            const asarPath = path.join(...pathSplit.slice(0, partWithAsarIndex + 1));
            let mainPath = pathSplit.length > partWithAsarIndex + 1 ? path.join.apply(pathSplit.slice(partWithAsarIndex + 1)) : "";
            mainPath += path.join(mainPath, pathParsed.base);
            await asarFileChecker_1.checkFileInArchive(path.join(resourcesDir, "app", asarPath), mainPath, messagePrefix);
        }
        else {
            const fullPath = path.join(resourcesDir, "app", relativeFile);
            const outStat = await fs_1.statOrNull(fullPath);
            if (outStat == null) {
                throw new Error(`${messagePrefix} "${fullPath}" does not exist. Seems like a wrong configuration.`);
            }
            else {
                //noinspection ES6MissingAwait
                if (!outStat.isFile()) {
                    throw new Error(`${messagePrefix} "${fullPath}" is not a file. Seems like a wrong configuration.`);
                }
            }
        }
    }
    async sanityCheckPackage(appOutDir, isAsar, framework) {
        const outStat = await fs_1.statOrNull(appOutDir);
        if (outStat == null) {
            throw new Error(`Output directory "${appOutDir}" does not exist. Seems like a wrong configuration.`);
        }
        else {
            //noinspection ES6MissingAwait
            if (!outStat.isDirectory()) {
                throw new Error(`Output directory "${appOutDir}" is not a directory. Seems like a wrong configuration.`);
            }
        }
        const resourcesDir = this.getResourcesDir(appOutDir);
        const mainFile = (framework.getMainFile == null ? null : framework.getMainFile(this.platform)) || this.info.metadata.main || "index.js";
        await this.checkFileInPackage(resourcesDir, mainFile, "Application entry file", isAsar);
        await this.checkFileInPackage(resourcesDir, "package.json", "Application", isAsar);
    }
    // tslint:disable-next-line:no-invalid-template-strings
    computeSafeArtifactName(suggestedName, ext, arch, skipDefaultArch = true, defaultArch, safePattern = "${name}-${version}-${arch}.${ext}") {
        return computeSafeArtifactNameIfNeeded(suggestedName, () => this.computeArtifactName(safePattern, ext, skipDefaultArch && arch === arch_1.defaultArchFromString(defaultArch) ? null : arch));
    }
    expandArtifactNamePattern(targetSpecificOptions, ext, arch, defaultPattern, skipDefaultArch = true, defaultArch) {
        const { pattern, isUserForced } = this.artifactPatternConfig(targetSpecificOptions, defaultPattern);
        return this.computeArtifactName(pattern, ext, !isUserForced && skipDefaultArch && arch === arch_1.defaultArchFromString(defaultArch) ? null : arch);
    }
    artifactPatternConfig(targetSpecificOptions, defaultPattern) {
        const userSpecifiedPattern = (targetSpecificOptions === null || targetSpecificOptions === void 0 ? void 0 : targetSpecificOptions.artifactName) || this.platformSpecificBuildOptions.artifactName || this.config.artifactName;
        return {
            isUserForced: !!userSpecifiedPattern,
            pattern: userSpecifiedPattern || defaultPattern || "${productName}-${version}-${arch}.${ext}",
        };
    }
    expandArtifactBeautyNamePattern(targetSpecificOptions, ext, arch) {
        // tslint:disable-next-line:no-invalid-template-strings
        return this.expandArtifactNamePattern(targetSpecificOptions, ext, arch, "${productName} ${version} ${arch}.${ext}", true);
    }
    computeArtifactName(pattern, ext, arch) {
        const archName = arch == null ? null : arch_1.getArtifactArchName(arch, ext);
        return this.expandMacro(pattern, archName, {
            ext,
        });
    }
    expandMacro(pattern, arch, extra = {}, isProductNameSanitized = true) {
        return macroExpander_1.expandMacro(pattern, arch, this.appInfo, { os: this.platform.buildConfigurationKey, ...extra }, isProductNameSanitized);
    }
    generateName2(ext, classifier, deployment) {
        const dotExt = ext == null ? "" : `.${ext}`;
        const separator = ext === "deb" ? "_" : "-";
        return `${deployment ? this.appInfo.name : this.appInfo.productFilename}${separator}${this.appInfo.version}${classifier == null ? "" : `${separator}${classifier}`}${dotExt}`;
    }
    getTempFile(suffix) {
        return this.info.tempDirManager.getTempFile({ suffix });
    }
    get fileAssociations() {
        return builder_util_1.asArray(this.config.fileAssociations).concat(builder_util_1.asArray(this.platformSpecificBuildOptions.fileAssociations));
    }
    async getResource(custom, ...names) {
        const resourcesDir = this.info.buildResourcesDir;
        if (custom === undefined) {
            const resourceList = await this.resourceList;
            for (const name of names) {
                if (resourceList.includes(name)) {
                    return path.join(resourcesDir, name);
                }
            }
        }
        else if (custom != null && !builder_util_1.isEmptyOrSpaces(custom)) {
            const resourceList = await this.resourceList;
            if (resourceList.includes(custom)) {
                return path.join(resourcesDir, custom);
            }
            let p = path.resolve(resourcesDir, custom);
            if ((await fs_1.statOrNull(p)) == null) {
                p = path.resolve(this.projectDir, custom);
                if ((await fs_1.statOrNull(p)) == null) {
                    throw new builder_util_1.InvalidConfigurationError(`cannot find specified resource "${custom}", nor relative to "${resourcesDir}", neither relative to project dir ("${this.projectDir}")`);
                }
            }
            return p;
        }
        return null;
    }
    get forceCodeSigning() {
        const forceCodeSigningPlatform = this.platformSpecificBuildOptions.forceCodeSigning;
        return (forceCodeSigningPlatform == null ? this.config.forceCodeSigning : forceCodeSigningPlatform) || false;
    }
    async getOrConvertIcon(format) {
        const result = await this.resolveIcon(builder_util_1.asArray(this.platformSpecificBuildOptions.icon || this.config.icon), [], format);
        if (result.length === 0) {
            const framework = this.info.framework;
            if (framework.getDefaultIcon != null) {
                return framework.getDefaultIcon(this.platform);
            }
            builder_util_1.log.warn({ reason: "application icon is not set" }, `default ${capitalizeFirstLetter(framework.name)} icon is used`);
            return this.getDefaultFrameworkIcon();
        }
        else {
            return result[0].file;
        }
    }
    getDefaultFrameworkIcon() {
        const framework = this.info.framework;
        return framework.getDefaultIcon == null ? null : framework.getDefaultIcon(this.platform);
    }
    // convert if need, validate size (it is a reason why tool is called even if file has target extension (already specified as foo.icns for example))
    async resolveIcon(sources, fallbackSources, outputFormat) {
        const args = [
            "icon",
            "--format",
            outputFormat,
            "--root",
            this.buildResourcesDir,
            "--root",
            this.projectDir,
            "--out",
            path.resolve(this.projectDir, this.config.directories.output, `.icon-${outputFormat}`),
        ];
        for (const source of sources) {
            args.push("--input", source);
        }
        for (const source of fallbackSources) {
            args.push("--fallback-input", source);
        }
        const result = await appBuilder_1.executeAppBuilderAsJson(args);
        const errorMessage = result.error;
        if (errorMessage != null) {
            throw new builder_util_1.InvalidConfigurationError(errorMessage, result.errorCode);
        }
        if (result.isFallback) {
            builder_util_1.log.warn({ reason: "application icon is not set" }, `default ${capitalizeFirstLetter(this.info.framework.name)} icon is used`);
        }
        return result.icons || [];
    }
}
exports.PlatformPackager = PlatformPackager;
function isSafeGithubName(name) {
    return /^[0-9A-Za-z._-]+$/.test(name);
}
exports.isSafeGithubName = isSafeGithubName;
function computeSafeArtifactNameIfNeeded(suggestedName, safeNameProducer) {
    // GitHub only allows the listed characters in file names.
    if (suggestedName != null) {
        if (isSafeGithubName(suggestedName)) {
            return null;
        }
        // prefer to use suggested name - so, if space is the only problem, just replace only space to dash
        suggestedName = suggestedName.replace(/ /g, "-");
        if (isSafeGithubName(suggestedName)) {
            return suggestedName;
        }
    }
    return safeNameProducer();
}
exports.computeSafeArtifactNameIfNeeded = computeSafeArtifactNameIfNeeded;
// remove leading dot
function normalizeExt(ext) {
    return ext.startsWith(".") ? ext.substring(1) : ext;
}
exports.normalizeExt = normalizeExt;
function resolveFunction(executor, name) {
    if (executor == null || typeof executor !== "string") {
        return executor;
    }
    let p = executor;
    if (p.startsWith(".")) {
        p = path.resolve(p);
    }
    try {
        p = require.resolve(p);
    }
    catch (e) {
        builder_util_1.debug(e);
        p = path.resolve(p);
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const m = require(p);
    const namedExport = m[name];
    if (namedExport == null) {
        return m.default || m;
    }
    else {
        return namedExport;
    }
}
exports.resolveFunction = resolveFunction;
function chooseNotNull(v1, v2) {
    return v1 == null ? v2 : v1;
}
exports.chooseNotNull = chooseNotNull;
function capitalizeFirstLetter(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
function isSafeToUnpackElectronOnRemoteBuildServer(packager) {
    if (packager.platform !== index_1.Platform.LINUX || packager.config.remoteBuild === false) {
        return false;
    }
    if (process.platform === "win32" || builder_util_1.isEnvTrue(process.env._REMOTE_BUILD)) {
        return packager.config.electronDist == null && packager.config.electronDownload == null;
    }
    return false;
}
exports.isSafeToUnpackElectronOnRemoteBuildServer = isSafeToUnpackElectronOnRemoteBuildServer;
//# sourceMappingURL=platformPackager.js.map