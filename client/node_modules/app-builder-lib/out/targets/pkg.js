"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareProductBuildArgs = exports.PkgTarget = void 0;
const builder_util_1 = require("builder-util");
const fs_1 = require("builder-util/out/fs");
const appBuilder_1 = require("../util/appBuilder");
const license_1 = require("../util/license");
const promises_1 = require("fs/promises");
const path = require("path");
const appInfo_1 = require("../appInfo");
const macCodeSign_1 = require("../codeSign/macCodeSign");
const core_1 = require("../core");
const certType = "Developer ID Installer";
// http://www.shanekirk.com/2013/10/creating-flat-packages-in-osx/
// to use --scripts, we must build .app bundle separately using pkgbuild
// productbuild --scripts doesn't work (because scripts in this case not added to our package)
// https://github.com/electron-userland/electron-osx-sign/issues/96#issuecomment-274986942
class PkgTarget extends core_1.Target {
    constructor(packager, outDir) {
        super("pkg");
        this.packager = packager;
        this.outDir = outDir;
        this.options = {
            allowAnywhere: true,
            allowCurrentUserHome: true,
            allowRootDirectory: true,
            ...this.packager.config.pkg,
        };
    }
    async build(appPath, arch) {
        const packager = this.packager;
        const options = this.options;
        const appInfo = packager.appInfo;
        // pkg doesn't like not ASCII symbols (Could not open package to list files: /Volumes/test/t-gIjdGK/test-project-0/dist/Test App ßW-1.1.0.pkg)
        const artifactName = packager.expandArtifactNamePattern(options, "pkg", arch);
        const artifactPath = path.join(this.outDir, artifactName);
        await packager.info.callArtifactBuildStarted({
            targetPresentableName: "pkg",
            file: artifactPath,
            arch,
        });
        const keychainFile = (await packager.codeSigningInfo.value).keychainFile;
        const appOutDir = this.outDir;
        // https://developer.apple.com/library/content/documentation/DeveloperTools/Reference/DistributionDefinitionRef/Chapters/Distribution_XML_Ref.html
        const distInfoFile = path.join(appOutDir, "distribution.xml");
        const innerPackageFile = path.join(appOutDir, `${appInfo_1.filterCFBundleIdentifier(appInfo.id)}.pkg`);
        const componentPropertyListFile = path.join(appOutDir, `${appInfo_1.filterCFBundleIdentifier(appInfo.id)}.plist`);
        const identity = (await Promise.all([
            macCodeSign_1.findIdentity(certType, options.identity || packager.platformSpecificBuildOptions.identity, keychainFile),
            this.customizeDistributionConfiguration(distInfoFile, appPath),
            this.buildComponentPackage(appPath, componentPropertyListFile, innerPackageFile),
        ]))[0];
        if (identity == null && packager.forceCodeSigning) {
            throw new Error(`Cannot find valid "${certType}" to sign standalone installer, please see https://electron.build/code-signing`);
        }
        const args = prepareProductBuildArgs(identity, keychainFile);
        args.push("--distribution", distInfoFile);
        args.push(artifactPath);
        builder_util_1.use(options.productbuild, it => args.push(...it));
        await builder_util_1.exec("productbuild", args, {
            cwd: appOutDir,
        });
        await Promise.all([promises_1.unlink(innerPackageFile), promises_1.unlink(distInfoFile)]);
        await packager.dispatchArtifactCreated(artifactPath, this, arch, packager.computeSafeArtifactName(artifactName, "pkg", arch));
    }
    async customizeDistributionConfiguration(distInfoFile, appPath) {
        await builder_util_1.exec("productbuild", ["--synthesize", "--component", appPath, distInfoFile], {
            cwd: this.outDir,
        });
        const options = this.options;
        let distInfo = await promises_1.readFile(distInfoFile, "utf-8");
        if (options.mustClose != null && options.mustClose.length !== 0) {
            const startContent = `    <pkg-ref id="${this.packager.appInfo.id}">\n        <must-close>\n`;
            const endContent = "        </must-close>\n    </pkg-ref>\n</installer-gui-script>";
            let mustCloseContent = "";
            options.mustClose.forEach(appId => {
                mustCloseContent += `            <app id="${appId}"/>\n`;
            });
            distInfo = distInfo.replace("</installer-gui-script>", `${startContent}${mustCloseContent}${endContent}`);
        }
        const insertIndex = distInfo.lastIndexOf("</installer-gui-script>");
        distInfo =
            distInfo.substring(0, insertIndex) +
                `    <domains enable_anywhere="${options.allowAnywhere}" enable_currentUserHome="${options.allowCurrentUserHome}" enable_localSystem="${options.allowRootDirectory}" />\n` +
                distInfo.substring(insertIndex);
        if (options.background != null) {
            const background = await this.packager.getResource(options.background.file);
            if (background != null) {
                const alignment = options.background.alignment || "center";
                // noinspection SpellCheckingInspection
                const scaling = options.background.scaling || "tofit";
                distInfo = distInfo.substring(0, insertIndex) + `    <background file="${background}" alignment="${alignment}" scaling="${scaling}"/>\n` + distInfo.substring(insertIndex);
                distInfo =
                    distInfo.substring(0, insertIndex) + `    <background-darkAqua file="${background}" alignment="${alignment}" scaling="${scaling}"/>\n` + distInfo.substring(insertIndex);
            }
        }
        const welcome = await this.packager.getResource(options.welcome);
        if (welcome != null) {
            distInfo = distInfo.substring(0, insertIndex) + `    <welcome file="${welcome}"/>\n` + distInfo.substring(insertIndex);
        }
        const license = await license_1.getNotLocalizedLicenseFile(options.license, this.packager);
        if (license != null) {
            distInfo = distInfo.substring(0, insertIndex) + `    <license file="${license}"/>\n` + distInfo.substring(insertIndex);
        }
        const conclusion = await this.packager.getResource(options.conclusion);
        if (conclusion != null) {
            distInfo = distInfo.substring(0, insertIndex) + `    <conclusion file="${conclusion}"/>\n` + distInfo.substring(insertIndex);
        }
        builder_util_1.debug(distInfo);
        await promises_1.writeFile(distInfoFile, distInfo);
    }
    async buildComponentPackage(appPath, propertyListOutputFile, packageOutputFile) {
        const options = this.options;
        const rootPath = path.dirname(appPath);
        // first produce a component plist template
        await builder_util_1.exec("pkgbuild", ["--analyze", "--root", rootPath, propertyListOutputFile]);
        // process the template plist
        const plistInfo = (await appBuilder_1.executeAppBuilderAsJson(["decode-plist", "-f", propertyListOutputFile]))[0].filter((it) => it.RootRelativeBundlePath !== "Electron.dSYM");
        if (plistInfo.length > 0) {
            const packageInfo = plistInfo[0];
            // ChildBundles lists all of electron binaries within the .app.
            // There is no particular reason for removing that key, except to be as close as possible to
            // the PackageInfo generated by previous versions of electron-builder.
            delete packageInfo.ChildBundles;
            if (options.isRelocatable != null) {
                packageInfo.BundleIsRelocatable = options.isRelocatable;
            }
            if (options.isVersionChecked != null) {
                packageInfo.BundleIsVersionChecked = options.isVersionChecked;
            }
            if (options.hasStrictIdentifier != null) {
                packageInfo.BundleHasStrictIdentifier = options.hasStrictIdentifier;
            }
            if (options.overwriteAction != null) {
                packageInfo.BundleOverwriteAction = options.overwriteAction;
            }
            await appBuilder_1.executeAppBuilderAndWriteJson(["encode-plist"], { [propertyListOutputFile]: plistInfo });
        }
        // now build the package
        const args = [
            "--root",
            rootPath,
            // "--identifier", this.packager.appInfo.id,
            "--component-plist",
            propertyListOutputFile,
        ];
        builder_util_1.use(this.options.installLocation || "/Applications", it => args.push("--install-location", it));
        if (options.scripts != null) {
            args.push("--scripts", path.resolve(this.packager.info.buildResourcesDir, options.scripts));
        }
        else if (options.scripts !== null) {
            const dir = path.join(this.packager.info.buildResourcesDir, "pkg-scripts");
            const stat = await fs_1.statOrNull(dir);
            if (stat != null && stat.isDirectory()) {
                args.push("--scripts", dir);
            }
        }
        args.push(packageOutputFile);
        await builder_util_1.exec("pkgbuild", args);
    }
}
exports.PkgTarget = PkgTarget;
function prepareProductBuildArgs(identity, keychain) {
    const args = [];
    if (identity != null) {
        args.push("--sign", identity.hash);
        if (keychain != null) {
            args.push("--keychain", keychain);
        }
    }
    return args;
}
exports.prepareProductBuildArgs = prepareProductBuildArgs;
//# sourceMappingURL=pkg.js.map