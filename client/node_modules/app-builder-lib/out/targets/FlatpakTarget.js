"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const flatpak_bundler_1 = require("@malept/flatpak-bundler");
const builder_util_1 = require("builder-util");
const fs_extra_1 = require("fs-extra");
const path = require("path");
const core_1 = require("../core");
const license_1 = require("../util/license");
const targetUtil_1 = require("./targetUtil");
class FlatpakTarget extends core_1.Target {
    constructor(name, packager, helper, outDir) {
        super(name);
        this.packager = packager;
        this.helper = helper;
        this.outDir = outDir;
        this.options = {
            ...this.packager.platformSpecificBuildOptions,
            ...this.packager.config[this.name],
        };
    }
    get appId() {
        return filterFlatpakAppIdentifier(this.packager.appInfo.id);
    }
    async build(appOutDir, arch) {
        const { packager, options } = this;
        const artifactName = packager.expandArtifactNamePattern(options, "flatpak", arch, undefined, false);
        const artifactPath = path.join(this.outDir, artifactName);
        await packager.info.callArtifactBuildStarted({
            targetPresentableName: "flatpak",
            file: artifactPath,
            arch,
        });
        const stageDir = await this.prepareStageDir(arch);
        const { manifest, buildOptions } = this.getFlatpakBuilderOptions(appOutDir, stageDir.dir, artifactName, arch);
        await flatpak_bundler_1.bundle(manifest, buildOptions);
        await stageDir.cleanup();
        await packager.info.callArtifactBuildCompleted({
            file: artifactPath,
            safeArtifactName: packager.computeSafeArtifactName(artifactName, "flatpak", arch, false),
            target: this,
            arch,
            packager,
            isWriteUpdateInfo: false,
        });
    }
    async prepareStageDir(arch) {
        const stageDir = await targetUtil_1.createStageDir(this, this.packager, arch);
        await Promise.all([this.createSandboxBinWrapper(stageDir), this.createDesktopFile(stageDir), this.copyLicenseFile(stageDir), this.copyIcons(stageDir)]);
        return stageDir;
    }
    async createSandboxBinWrapper(stageDir) {
        const useWaylandFlags = !!this.options.useWaylandFlags;
        const electronWrapperPath = stageDir.getTempFile(path.join("bin", "electron-wrapper"));
        await fs_extra_1.outputFile(electronWrapperPath, getElectronWrapperScript(this.packager.executableName, useWaylandFlags));
        await fs_extra_1.chmod(electronWrapperPath, 0o755);
    }
    async createDesktopFile(stageDir) {
        const appIdentifier = this.appId;
        const desktopFile = stageDir.getTempFile(path.join("share", "applications", `${appIdentifier}.desktop`));
        await this.helper.writeDesktopEntry(this.options, "electron-wrapper %U", desktopFile, { Icon: appIdentifier });
    }
    async copyLicenseFile(stageDir) {
        const licenseSrc = await license_1.getNotLocalizedLicenseFile(this.options.license, this.packager, ["txt", "html"]);
        if (licenseSrc) {
            const licenseDst = stageDir.getTempFile(path.join("share", "doc", this.appId, "copyright"));
            await builder_util_1.copyFile(licenseSrc, licenseDst);
        }
    }
    async copyIcons(stageDir) {
        const icons = await this.helper.icons;
        const copyIcons = icons.map(async (icon) => {
            const extWithDot = path.extname(icon.file);
            const sizeName = extWithDot === ".svg" ? "scalable" : `${icon.size}x${icon.size}`;
            const iconDst = stageDir.getTempFile(path.join("share", "icons", "hicolor", sizeName, "apps", `${this.appId}${extWithDot}`));
            return builder_util_1.copyFile(icon.file, iconDst);
        });
        await Promise.all(copyIcons);
    }
    getFlatpakBuilderOptions(appOutDir, stageDir, artifactName, arch) {
        const appIdentifier = this.appId;
        const { executableName } = this.packager;
        const flatpakArch = builder_util_1.toLinuxArchString(arch, "flatpak");
        const manifest = {
            id: appIdentifier,
            command: "electron-wrapper",
            runtime: this.options.runtime || flatpakBuilderDefaults.runtime,
            runtimeVersion: this.options.runtimeVersion || flatpakBuilderDefaults.runtimeVersion,
            sdk: this.options.sdk || flatpakBuilderDefaults.sdk,
            base: this.options.base || flatpakBuilderDefaults.base,
            baseVersion: this.options.baseVersion || flatpakBuilderDefaults.baseVersion,
            finishArgs: this.options.finishArgs || flatpakBuilderDefaults.finishArgs,
            branch: this.options.branch,
            modules: this.options.modules,
        };
        const buildOptions = {
            baseFlatpakref: `app/${manifest.base}/${flatpakArch}/${manifest.baseVersion}`,
            runtimeFlatpakref: `runtime/${manifest.runtime}/${flatpakArch}/${manifest.runtimeVersion}`,
            sdkFlatpakref: `runtime/${manifest.sdk}/${flatpakArch}/${manifest.runtimeVersion}`,
            arch: flatpakArch,
            bundlePath: path.join(this.outDir, artifactName),
            files: [[stageDir, "/"], [appOutDir, path.join("/lib", appIdentifier)], ...(this.options.files || [])],
            symlinks: [[path.join("/lib", appIdentifier, executableName), path.join("/bin", executableName)], ...(this.options.symlinks || [])],
        };
        return { manifest, buildOptions };
    }
}
exports.default = FlatpakTarget;
const flatpakBuilderDefaults = {
    runtime: "org.freedesktop.Platform",
    runtimeVersion: "20.08",
    sdk: "org.freedesktop.Sdk",
    base: "org.electronjs.Electron2.BaseApp",
    baseVersion: "20.08",
    finishArgs: [
        // Wayland/X11 Rendering
        "--socket=wayland",
        "--socket=x11",
        "--share=ipc",
        // Open GL
        "--device=dri",
        // Audio output
        "--socket=pulseaudio",
        // Read/write home directory access
        "--filesystem=home",
        // Allow communication with network
        "--share=network",
        // System notifications with libnotify
        "--talk-name=org.freedesktop.Notifications",
    ],
};
function getElectronWrapperScript(executableName, useWaylandFlags) {
    return useWaylandFlags
        ? `#!/bin/sh

export TMPDIR="$XDG_RUNTIME_DIR/app/$FLATPAK_ID"

if [ "\${XDG_SESSION_TYPE}" == "wayland" ]; then
    zypak-wrapper "${executableName}" --enable-features=UseOzonePlatform --ozone-platform=wayland "$@"
else
    zypak-wrapper "${executableName}" "$@"
fi
`
        : `#!/bin/sh

export TMPDIR="$XDG_RUNTIME_DIR/app/$FLATPAK_ID"

zypak-wrapper "${executableName}" "$@"
`;
}
function filterFlatpakAppIdentifier(identifier) {
    // Remove special characters and allow only alphanumeric (A-Z,a-z,0-9), underscore (_), and period (.)
    // Flatpak documentation: https://docs.flatpak.org/en/latest/conventions.html#application-ids
    return identifier.replace(/-/g, "_").replace(/[^a-zA-Z0-9._]/g, "");
}
//# sourceMappingURL=FlatpakTarget.js.map