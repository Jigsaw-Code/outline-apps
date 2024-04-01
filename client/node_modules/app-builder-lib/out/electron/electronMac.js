"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMacApp = void 0;
const bluebird_lst_1 = require("bluebird-lst");
const builder_util_1 = require("builder-util");
const fs_1 = require("builder-util/out/fs");
const promises_1 = require("fs/promises");
const path = require("path");
const appInfo_1 = require("../appInfo");
const platformPackager_1 = require("../platformPackager");
const appBuilder_1 = require("../util/appBuilder");
const ElectronFramework_1 = require("./ElectronFramework");
function doRename(basePath, oldName, newName) {
    return promises_1.rename(path.join(basePath, oldName), path.join(basePath, newName));
}
function moveHelpers(helperSuffixes, frameworksPath, appName, prefix) {
    return bluebird_lst_1.default.map(helperSuffixes, suffix => {
        const executableBasePath = path.join(frameworksPath, `${prefix}${suffix}.app`, "Contents", "MacOS");
        return doRename(executableBasePath, `${prefix}${suffix}`, appName + suffix).then(() => doRename(frameworksPath, `${prefix}${suffix}.app`, `${appName}${suffix}.app`));
    });
}
function getAvailableHelperSuffixes(helperEHPlist, helperNPPlist, helperRendererPlist, helperPluginPlist, helperGPUPlist) {
    const result = [" Helper"];
    if (helperEHPlist != null) {
        result.push(" Helper EH");
    }
    if (helperNPPlist != null) {
        result.push(" Helper NP");
    }
    if (helperRendererPlist != null) {
        result.push(" Helper (Renderer)");
    }
    if (helperPluginPlist != null) {
        result.push(" Helper (Plugin)");
    }
    if (helperGPUPlist != null) {
        result.push(" Helper (GPU)");
    }
    return result;
}
/** @internal */
async function createMacApp(packager, appOutDir, asarIntegrity, isMas) {
    const appInfo = packager.appInfo;
    const appFilename = appInfo.productFilename;
    const electronBranding = ElectronFramework_1.createBrandingOpts(packager.config);
    const contentsPath = path.join(appOutDir, packager.info.framework.distMacOsAppName, "Contents");
    const frameworksPath = path.join(contentsPath, "Frameworks");
    const loginItemPath = path.join(contentsPath, "Library", "LoginItems");
    const appPlistFilename = path.join(contentsPath, "Info.plist");
    const helperPlistFilename = path.join(frameworksPath, `${electronBranding.productName} Helper.app`, "Contents", "Info.plist");
    const helperEHPlistFilename = path.join(frameworksPath, `${electronBranding.productName} Helper EH.app`, "Contents", "Info.plist");
    const helperNPPlistFilename = path.join(frameworksPath, `${electronBranding.productName} Helper NP.app`, "Contents", "Info.plist");
    const helperRendererPlistFilename = path.join(frameworksPath, `${electronBranding.productName} Helper (Renderer).app`, "Contents", "Info.plist");
    const helperPluginPlistFilename = path.join(frameworksPath, `${electronBranding.productName} Helper (Plugin).app`, "Contents", "Info.plist");
    const helperGPUPlistFilename = path.join(frameworksPath, `${electronBranding.productName} Helper (GPU).app`, "Contents", "Info.plist");
    const helperLoginPlistFilename = path.join(loginItemPath, `${electronBranding.productName} Login Helper.app`, "Contents", "Info.plist");
    const plistContent = await appBuilder_1.executeAppBuilderAsJson([
        "decode-plist",
        "-f",
        appPlistFilename,
        "-f",
        helperPlistFilename,
        "-f",
        helperEHPlistFilename,
        "-f",
        helperNPPlistFilename,
        "-f",
        helperRendererPlistFilename,
        "-f",
        helperPluginPlistFilename,
        "-f",
        helperGPUPlistFilename,
        "-f",
        helperLoginPlistFilename,
    ]);
    if (plistContent[0] == null) {
        throw new Error("corrupted Electron dist");
    }
    const appPlist = plistContent[0];
    const helperPlist = plistContent[1];
    const helperEHPlist = plistContent[2];
    const helperNPPlist = plistContent[3];
    const helperRendererPlist = plistContent[4];
    const helperPluginPlist = plistContent[5];
    const helperGPUPlist = plistContent[6];
    const helperLoginPlist = plistContent[7];
    // if an extend-info file was supplied, copy its contents in first
    if (plistContent[8] != null) {
        Object.assign(appPlist, plistContent[8]);
    }
    const buildMetadata = packager.config;
    /**
     * Configure bundleIdentifier for the generic Electron Helper process
     *
     * This was the only Helper in Electron 5 and before. Allow users to configure
     * the bundleIdentifier for continuity.
     */
    const oldHelperBundleId = buildMetadata["helper-bundle-id"];
    if (oldHelperBundleId != null) {
        builder_util_1.log.warn("build.helper-bundle-id is deprecated, please set as build.mac.helperBundleId");
    }
    const helperBundleIdentifier = appInfo_1.filterCFBundleIdentifier(packager.platformSpecificBuildOptions.helperBundleId || oldHelperBundleId || `${appInfo.macBundleIdentifier}.helper`);
    await packager.applyCommonInfo(appPlist, contentsPath);
    // required for electron-updater proxy
    if (!isMas) {
        configureLocalhostAts(appPlist);
    }
    helperPlist.CFBundleExecutable = `${appFilename} Helper`;
    helperPlist.CFBundleDisplayName = `${appInfo.productName} Helper`;
    helperPlist.CFBundleIdentifier = helperBundleIdentifier;
    helperPlist.CFBundleVersion = appPlist.CFBundleVersion;
    /**
     * Configure bundleIdentifier for Electron 5+ Helper processes
     *
     * In Electron 6, parts of the generic Electron Helper process were split into
     * individual helper processes. Allow users to configure the bundleIdentifiers
     * for continuity, specifically because macOS keychain access relies on
     * bundleIdentifiers not changing (i.e. across versions of Electron).
     */
    function configureHelper(helper, postfix, userProvidedBundleIdentifier) {
        helper.CFBundleExecutable = `${appFilename} Helper ${postfix}`;
        helper.CFBundleDisplayName = `${appInfo.productName} Helper ${postfix}`;
        helper.CFBundleIdentifier = userProvidedBundleIdentifier
            ? appInfo_1.filterCFBundleIdentifier(userProvidedBundleIdentifier)
            : appInfo_1.filterCFBundleIdentifier(`${helperBundleIdentifier}.${postfix}`);
        helper.CFBundleVersion = appPlist.CFBundleVersion;
    }
    if (helperRendererPlist != null) {
        configureHelper(helperRendererPlist, "(Renderer)", packager.platformSpecificBuildOptions.helperRendererBundleId);
    }
    if (helperPluginPlist != null) {
        configureHelper(helperPluginPlist, "(Plugin)", packager.platformSpecificBuildOptions.helperPluginBundleId);
    }
    if (helperGPUPlist != null) {
        configureHelper(helperGPUPlist, "(GPU)", packager.platformSpecificBuildOptions.helperGPUBundleId);
    }
    if (helperEHPlist != null) {
        configureHelper(helperEHPlist, "EH", packager.platformSpecificBuildOptions.helperEHBundleId);
    }
    if (helperNPPlist != null) {
        configureHelper(helperNPPlist, "NP", packager.platformSpecificBuildOptions.helperNPBundleId);
    }
    if (helperLoginPlist != null) {
        helperLoginPlist.CFBundleExecutable = `${appFilename} Login Helper`;
        helperLoginPlist.CFBundleDisplayName = `${appInfo.productName} Login Helper`;
        // noinspection SpellCheckingInspection
        helperLoginPlist.CFBundleIdentifier = `${appInfo.macBundleIdentifier}.loginhelper`;
        helperLoginPlist.CFBundleVersion = appPlist.CFBundleVersion;
    }
    const protocols = builder_util_1.asArray(buildMetadata.protocols).concat(builder_util_1.asArray(packager.platformSpecificBuildOptions.protocols));
    if (protocols.length > 0) {
        appPlist.CFBundleURLTypes = protocols.map(protocol => {
            const schemes = builder_util_1.asArray(protocol.schemes);
            if (schemes.length === 0) {
                throw new builder_util_1.InvalidConfigurationError(`Protocol "${protocol.name}": must be at least one scheme specified`);
            }
            return {
                CFBundleURLName: protocol.name,
                CFBundleTypeRole: protocol.role || "Editor",
                CFBundleURLSchemes: schemes.slice(),
            };
        });
    }
    const fileAssociations = packager.fileAssociations;
    if (fileAssociations.length > 0) {
        appPlist.CFBundleDocumentTypes = await bluebird_lst_1.default.map(fileAssociations, async (fileAssociation) => {
            const extensions = builder_util_1.asArray(fileAssociation.ext).map(platformPackager_1.normalizeExt);
            const customIcon = await packager.getResource(builder_util_1.getPlatformIconFileName(fileAssociation.icon, true), `${extensions[0]}.icns`);
            let iconFile = appPlist.CFBundleIconFile;
            if (customIcon != null) {
                iconFile = path.basename(customIcon);
                await fs_1.copyOrLinkFile(customIcon, path.join(path.join(contentsPath, "Resources"), iconFile));
            }
            const result = {
                CFBundleTypeExtensions: extensions,
                CFBundleTypeName: fileAssociation.name || extensions[0],
                CFBundleTypeRole: fileAssociation.role || "Editor",
                LSHandlerRank: fileAssociation.rank || "Default",
                CFBundleTypeIconFile: iconFile,
            };
            if (fileAssociation.isPackage) {
                result.LSTypeIsPackage = true;
            }
            return result;
        });
    }
    if (asarIntegrity != null) {
        appPlist.ElectronAsarIntegrity = asarIntegrity;
    }
    const plistDataToWrite = {
        [appPlistFilename]: appPlist,
        [helperPlistFilename]: helperPlist,
    };
    if (helperEHPlist != null) {
        plistDataToWrite[helperEHPlistFilename] = helperEHPlist;
    }
    if (helperNPPlist != null) {
        plistDataToWrite[helperNPPlistFilename] = helperNPPlist;
    }
    if (helperRendererPlist != null) {
        plistDataToWrite[helperRendererPlistFilename] = helperRendererPlist;
    }
    if (helperPluginPlist != null) {
        plistDataToWrite[helperPluginPlistFilename] = helperPluginPlist;
    }
    if (helperGPUPlist != null) {
        plistDataToWrite[helperGPUPlistFilename] = helperGPUPlist;
    }
    if (helperLoginPlist != null) {
        plistDataToWrite[helperLoginPlistFilename] = helperLoginPlist;
    }
    await Promise.all([
        appBuilder_1.executeAppBuilderAndWriteJson(["encode-plist"], plistDataToWrite),
        doRename(path.join(contentsPath, "MacOS"), electronBranding.productName, appPlist.CFBundleExecutable),
        fs_1.unlinkIfExists(path.join(appOutDir, "LICENSE")),
        fs_1.unlinkIfExists(path.join(appOutDir, "LICENSES.chromium.html")),
    ]);
    await moveHelpers(getAvailableHelperSuffixes(helperEHPlist, helperNPPlist, helperRendererPlist, helperPluginPlist, helperGPUPlist), frameworksPath, appFilename, electronBranding.productName);
    if (helperLoginPlist != null) {
        const prefix = electronBranding.productName;
        const suffix = " Login Helper";
        const executableBasePath = path.join(loginItemPath, `${prefix}${suffix}.app`, "Contents", "MacOS");
        await doRename(executableBasePath, `${prefix}${suffix}`, appFilename + suffix).then(() => doRename(loginItemPath, `${prefix}${suffix}.app`, `${appFilename}${suffix}.app`));
    }
    const appPath = path.join(appOutDir, `${appFilename}.app`);
    await promises_1.rename(path.dirname(contentsPath), appPath);
    // https://github.com/electron-userland/electron-builder/issues/840
    const now = Date.now() / 1000;
    await promises_1.utimes(appPath, now, now);
}
exports.createMacApp = createMacApp;
function configureLocalhostAts(appPlist) {
    // https://bencoding.com/2015/07/20/app-transport-security-and-localhost/
    let ats = appPlist.NSAppTransportSecurity;
    if (ats == null) {
        ats = {};
        appPlist.NSAppTransportSecurity = ats;
    }
    ats.NSAllowsLocalNetworking = true;
    // https://github.com/electron-userland/electron-builder/issues/3377#issuecomment-446035814
    ats.NSAllowsArbitraryLoads = true;
    let exceptionDomains = ats.NSExceptionDomains;
    if (exceptionDomains == null) {
        exceptionDomains = {};
        ats.NSExceptionDomains = exceptionDomains;
    }
    if (exceptionDomains.localhost == null) {
        const allowHttp = {
            NSTemporaryExceptionAllowsInsecureHTTPSLoads: false,
            NSIncludesSubdomains: false,
            NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
            NSTemporaryExceptionMinimumTLSVersion: "1.0",
            NSTemporaryExceptionRequiresForwardSecrecy: false,
        };
        exceptionDomains.localhost = allowHttp;
        exceptionDomains["127.0.0.1"] = allowHttp;
    }
}
//# sourceMappingURL=electronMac.js.map