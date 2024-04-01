"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bluebird_lst_1 = require("bluebird-lst");
const builder_util_1 = require("builder-util");
const fs_1 = require("builder-util/out/fs");
const fs_extra_1 = require("fs-extra");
const path = require("path");
const windowsCodeSign_1 = require("../codeSign/windowsCodeSign");
const core_1 = require("../core");
const pathManager_1 = require("../util/pathManager");
const targetUtil_1 = require("./targetUtil");
const APPX_ASSETS_DIR_NAME = "appx";
const vendorAssetsForDefaultAssets = {
    "StoreLogo.png": "SampleAppx.50x50.png",
    "Square150x150Logo.png": "SampleAppx.150x150.png",
    "Square44x44Logo.png": "SampleAppx.44x44.png",
    "Wide310x150Logo.png": "SampleAppx.310x150.png",
};
const DEFAULT_RESOURCE_LANG = "en-US";
class AppXTarget extends core_1.Target {
    constructor(packager, outDir) {
        super("appx");
        this.packager = packager;
        this.outDir = outDir;
        this.options = builder_util_1.deepAssign({}, this.packager.platformSpecificBuildOptions, this.packager.config.appx);
        if (process.platform !== "darwin" && (process.platform !== "win32" || windowsCodeSign_1.isOldWin6())) {
            throw new Error("AppX is supported only on Windows 10 or Windows Server 2012 R2 (version number 6.3+)");
        }
    }
    // https://docs.microsoft.com/en-us/windows/uwp/packaging/create-app-package-with-makeappx-tool#mapping-files
    async build(appOutDir, arch) {
        const packager = this.packager;
        const artifactName = packager.expandArtifactBeautyNamePattern(this.options, "appx", arch);
        const artifactPath = path.join(this.outDir, artifactName);
        await packager.info.callArtifactBuildStarted({
            targetPresentableName: "AppX",
            file: artifactPath,
            arch,
        });
        const vendorPath = await windowsCodeSign_1.getSignVendorPath();
        const vm = await packager.vm.value;
        const stageDir = await targetUtil_1.createStageDir(this, packager, arch);
        const mappingFile = stageDir.getTempFile("mapping.txt");
        const makeAppXArgs = ["pack", "/o" /* overwrite the output file if it exists */, "/f", vm.toVmFile(mappingFile), "/p", vm.toVmFile(artifactPath)];
        if (packager.compression === "store") {
            makeAppXArgs.push("/nc");
        }
        const mappingList = [];
        mappingList.push(await bluebird_lst_1.default.map(fs_1.walk(appOutDir), file => {
            let appxPath = file.substring(appOutDir.length + 1);
            if (path.sep !== "\\") {
                appxPath = appxPath.replace(/\//g, "\\");
            }
            return `"${vm.toVmFile(file)}" "app\\${appxPath}"`;
        }));
        const userAssetDir = await this.packager.getResource(undefined, APPX_ASSETS_DIR_NAME);
        const assetInfo = await AppXTarget.computeUserAssets(vm, vendorPath, userAssetDir);
        const userAssets = assetInfo.userAssets;
        const manifestFile = stageDir.getTempFile("AppxManifest.xml");
        await this.writeManifest(manifestFile, arch, await this.computePublisherName(), userAssets);
        await packager.info.callAppxManifestCreated(manifestFile);
        mappingList.push(assetInfo.mappings);
        mappingList.push([`"${vm.toVmFile(manifestFile)}" "AppxManifest.xml"`]);
        const signToolArch = arch === builder_util_1.Arch.arm64 ? "x64" : builder_util_1.Arch[arch];
        if (isScaledAssetsProvided(userAssets)) {
            const outFile = vm.toVmFile(stageDir.getTempFile("resources.pri"));
            const makePriPath = vm.toVmFile(path.join(vendorPath, "windows-10", signToolArch, "makepri.exe"));
            const assetRoot = stageDir.getTempFile("appx/assets");
            await fs_extra_1.emptyDir(assetRoot);
            await bluebird_lst_1.default.map(assetInfo.allAssets, it => fs_1.copyOrLinkFile(it, path.join(assetRoot, path.basename(it))));
            await vm.exec(makePriPath, [
                "new",
                "/Overwrite",
                "/Manifest",
                vm.toVmFile(manifestFile),
                "/ProjectRoot",
                vm.toVmFile(path.dirname(assetRoot)),
                "/ConfigXml",
                vm.toVmFile(path.join(pathManager_1.getTemplatePath("appx"), "priconfig.xml")),
                "/OutputFile",
                outFile,
            ]);
            // in addition to resources.pri, resources.scale-140.pri and other such files will be generated
            for (const resourceFile of (await fs_extra_1.readdir(stageDir.dir)).filter(it => it.startsWith("resources.")).sort()) {
                mappingList.push([`"${vm.toVmFile(stageDir.getTempFile(resourceFile))}" "${resourceFile}"`]);
            }
            makeAppXArgs.push("/l");
        }
        let mapping = "[Files]";
        for (const list of mappingList) {
            mapping += "\r\n" + list.join("\r\n");
        }
        await fs_extra_1.writeFile(mappingFile, mapping);
        packager.debugLogger.add("appx.mapping", mapping);
        if (this.options.makeappxArgs != null) {
            makeAppXArgs.push(...this.options.makeappxArgs);
        }
        await vm.exec(vm.toVmFile(path.join(vendorPath, "windows-10", signToolArch, "makeappx.exe")), makeAppXArgs);
        await packager.sign(artifactPath);
        await stageDir.cleanup();
        await packager.info.callArtifactBuildCompleted({
            file: artifactPath,
            packager,
            arch,
            safeArtifactName: packager.computeSafeArtifactName(artifactName, "appx"),
            target: this,
            isWriteUpdateInfo: this.options.electronUpdaterAware,
        });
    }
    static async computeUserAssets(vm, vendorPath, userAssetDir) {
        const mappings = [];
        let userAssets;
        const allAssets = [];
        if (userAssetDir == null) {
            userAssets = [];
        }
        else {
            userAssets = (await fs_extra_1.readdir(userAssetDir)).filter(it => !it.startsWith(".") && !it.endsWith(".db") && it.includes("."));
            for (const name of userAssets) {
                mappings.push(`"${vm.toVmFile(userAssetDir)}${vm.pathSep}${name}" "assets\\${name}"`);
                allAssets.push(path.join(userAssetDir, name));
            }
        }
        for (const defaultAsset of Object.keys(vendorAssetsForDefaultAssets)) {
            if (userAssets.length === 0 || !isDefaultAssetIncluded(userAssets, defaultAsset)) {
                const file = path.join(vendorPath, "appxAssets", vendorAssetsForDefaultAssets[defaultAsset]);
                mappings.push(`"${vm.toVmFile(file)}" "assets\\${defaultAsset}"`);
                allAssets.push(file);
            }
        }
        // we do not use process.arch to build path to tools, because even if you are on x64, ia32 appx tool must be used if you build appx for ia32
        return { userAssets, mappings, allAssets };
    }
    // https://github.com/electron-userland/electron-builder/issues/2108#issuecomment-333200711
    async computePublisherName() {
        if ((await this.packager.cscInfo.value) == null) {
            builder_util_1.log.info({ reason: "Windows Store only build" }, "AppX is not signed");
            return this.options.publisher || "CN=ms";
        }
        const certInfo = await this.packager.lazyCertInfo.value;
        const publisher = this.options.publisher || (certInfo == null ? null : certInfo.bloodyMicrosoftSubjectDn);
        if (publisher == null) {
            throw new Error("Internal error: cannot compute subject using certificate info");
        }
        return publisher;
    }
    async writeManifest(outFile, arch, publisher, userAssets) {
        const appInfo = this.packager.appInfo;
        const options = this.options;
        const executable = `app\\${appInfo.productFilename}.exe`;
        const displayName = options.displayName || appInfo.productName;
        const extensions = await this.getExtensions(executable, displayName);
        const manifest = (await fs_extra_1.readFile(path.join(pathManager_1.getTemplatePath("appx"), "appxmanifest.xml"), "utf8")).replace(/\${([a-zA-Z0-9]+)}/g, (match, p1) => {
            switch (p1) {
                case "publisher":
                    return publisher;
                case "publisherDisplayName": {
                    const name = options.publisherDisplayName || appInfo.companyName;
                    if (name == null) {
                        throw new builder_util_1.InvalidConfigurationError(`Please specify "author" in the application package.json — it is required because "appx.publisherDisplayName" is not set.`);
                    }
                    return name;
                }
                case "version":
                    return appInfo.getVersionInWeirdWindowsForm(options.setBuildNumber === true);
                case "applicationId": {
                    const result = options.applicationId || options.identityName || appInfo.name;
                    if (!isNaN(parseInt(result[0], 10))) {
                        let message = `AppX Application.Id can’t start with numbers: "${result}"`;
                        if (options.applicationId == null) {
                            message += `\nPlease set appx.applicationId (or correct appx.identityName or name)`;
                        }
                        throw new builder_util_1.InvalidConfigurationError(message);
                    }
                    return result;
                }
                case "identityName":
                    return options.identityName || appInfo.name;
                case "executable":
                    return executable;
                case "displayName":
                    return displayName;
                case "description":
                    return appInfo.description || appInfo.productName;
                case "backgroundColor":
                    return options.backgroundColor || "#464646";
                case "logo":
                    return "assets\\StoreLogo.png";
                case "square150x150Logo":
                    return "assets\\Square150x150Logo.png";
                case "square44x44Logo":
                    return "assets\\Square44x44Logo.png";
                case "lockScreen":
                    return lockScreenTag(userAssets);
                case "defaultTile":
                    return defaultTileTag(userAssets, options.showNameOnTiles || false);
                case "splashScreen":
                    return splashScreenTag(userAssets);
                case "arch":
                    return arch === builder_util_1.Arch.ia32 ? "x86" : arch === builder_util_1.Arch.arm64 ? "arm64" : "x64";
                case "resourceLanguages":
                    return resourceLanguageTag(builder_util_1.asArray(options.languages));
                case "extensions":
                    return extensions;
                case "minVersion":
                    return arch === builder_util_1.Arch.arm64 ? "10.0.16299.0" : "10.0.14316.0";
                case "maxVersionTested":
                    return arch === builder_util_1.Arch.arm64 ? "10.0.16299.0" : "10.0.14316.0";
                default:
                    throw new Error(`Macro ${p1} is not defined`);
            }
        });
        await fs_extra_1.writeFile(outFile, manifest);
    }
    async getExtensions(executable, displayName) {
        const uriSchemes = builder_util_1.asArray(this.packager.config.protocols).concat(builder_util_1.asArray(this.packager.platformSpecificBuildOptions.protocols));
        const fileAssociations = builder_util_1.asArray(this.packager.config.fileAssociations).concat(builder_util_1.asArray(this.packager.platformSpecificBuildOptions.fileAssociations));
        let isAddAutoLaunchExtension = this.options.addAutoLaunchExtension;
        if (isAddAutoLaunchExtension === undefined) {
            const deps = this.packager.info.metadata.dependencies;
            isAddAutoLaunchExtension = deps != null && deps["electron-winstore-auto-launch"] != null;
        }
        if (!isAddAutoLaunchExtension && uriSchemes.length === 0 && fileAssociations.length === 0 && this.options.customExtensionsPath === undefined) {
            return "";
        }
        let extensions = "<Extensions>";
        if (isAddAutoLaunchExtension) {
            extensions += `
        <desktop:Extension Category="windows.startupTask" Executable="${executable}" EntryPoint="Windows.FullTrustApplication">
          <desktop:StartupTask TaskId="SlackStartup" Enabled="true" DisplayName="${displayName}" />
        </desktop:Extension>`;
        }
        for (const protocol of uriSchemes) {
            for (const scheme of builder_util_1.asArray(protocol.schemes)) {
                extensions += `
          <uap:Extension Category="windows.protocol">
            <uap:Protocol Name="${scheme}">
               <uap:DisplayName>${protocol.name}</uap:DisplayName>
             </uap:Protocol>
          </uap:Extension>`;
            }
        }
        for (const fileAssociation of fileAssociations) {
            for (const ext of builder_util_1.asArray(fileAssociation.ext)) {
                extensions += `
          <uap:Extension Category="windows.fileTypeAssociation">
            <uap:FileTypeAssociation Name="${ext}">
              <uap:SupportedFileTypes>
                <uap:FileType>.${ext}</uap:FileType>
              </uap:SupportedFileTypes>
            </uap:FileTypeAssociation>
          </uap:Extension>`;
            }
        }
        if (this.options.customExtensionsPath !== undefined) {
            const extensionsPath = path.resolve(this.packager.info.appDir, this.options.customExtensionsPath);
            extensions += await fs_extra_1.readFile(extensionsPath, "utf8");
        }
        extensions += "</Extensions>";
        return extensions;
    }
}
exports.default = AppXTarget;
// get the resource - language tag, see https://docs.microsoft.com/en-us/windows/uwp/globalizing/manage-language-and-region#specify-the-supported-languages-in-the-apps-manifest
function resourceLanguageTag(userLanguages) {
    if (userLanguages == null || userLanguages.length === 0) {
        userLanguages = [DEFAULT_RESOURCE_LANG];
    }
    return userLanguages.map(it => `<Resource Language="${it.replace(/_/g, "-")}" />`).join("\n");
}
function lockScreenTag(userAssets) {
    if (isDefaultAssetIncluded(userAssets, "BadgeLogo.png")) {
        return '<uap:LockScreen Notification="badgeAndTileText" BadgeLogo="assets\\BadgeLogo.png" />';
    }
    else {
        return "";
    }
}
function defaultTileTag(userAssets, showNameOnTiles) {
    const defaultTiles = ["<uap:DefaultTile", 'Wide310x150Logo="assets\\Wide310x150Logo.png"'];
    if (isDefaultAssetIncluded(userAssets, "LargeTile.png")) {
        defaultTiles.push('Square310x310Logo="assets\\LargeTile.png"');
    }
    if (isDefaultAssetIncluded(userAssets, "SmallTile.png")) {
        defaultTiles.push('Square71x71Logo="assets\\SmallTile.png"');
    }
    if (showNameOnTiles) {
        defaultTiles.push(">");
        defaultTiles.push("<uap:ShowNameOnTiles>");
        defaultTiles.push("<uap:ShowOn", 'Tile="wide310x150Logo"', "/>");
        defaultTiles.push("<uap:ShowOn", 'Tile="square150x150Logo"', "/>");
        defaultTiles.push("</uap:ShowNameOnTiles>");
        defaultTiles.push("</uap:DefaultTile>");
    }
    else {
        defaultTiles.push("/>");
    }
    return defaultTiles.join(" ");
}
function splashScreenTag(userAssets) {
    if (isDefaultAssetIncluded(userAssets, "SplashScreen.png")) {
        return '<uap:SplashScreen Image="assets\\SplashScreen.png" />';
    }
    else {
        return "";
    }
}
function isDefaultAssetIncluded(userAssets, defaultAsset) {
    const defaultAssetName = defaultAsset.substring(0, defaultAsset.indexOf("."));
    return userAssets.some(it => it.includes(defaultAssetName));
}
function isScaledAssetsProvided(userAssets) {
    return userAssets.some(it => it.includes(".scale-") || it.includes(".targetsize-"));
}
//# sourceMappingURL=AppxTarget.js.map