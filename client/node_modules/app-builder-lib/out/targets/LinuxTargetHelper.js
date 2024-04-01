"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinuxTargetHelper = exports.installPrefix = void 0;
const builder_util_1 = require("builder-util");
const fs_extra_1 = require("fs-extra");
const lazy_val_1 = require("lazy-val");
const path_1 = require("path");
exports.installPrefix = "/opt";
class LinuxTargetHelper {
    constructor(packager) {
        this.packager = packager;
        this.iconPromise = new lazy_val_1.Lazy(() => this.computeDesktopIcons());
        this.mimeTypeFilesPromise = new lazy_val_1.Lazy(() => this.computeMimeTypeFiles());
        this.maxIconPath = null;
    }
    get icons() {
        return this.iconPromise.value;
    }
    get mimeTypeFiles() {
        return this.mimeTypeFilesPromise.value;
    }
    async computeMimeTypeFiles() {
        const items = [];
        for (const fileAssociation of this.packager.fileAssociations) {
            if (!fileAssociation.mimeType) {
                continue;
            }
            const data = `<mime-type type="${fileAssociation.mimeType}">
  <glob pattern="*.${fileAssociation.ext}"/>
    ${fileAssociation.description ? `<comment>${fileAssociation.description}</comment>` : ""}
  <icon name="x-office-document" />
</mime-type>`;
            items.push(data);
        }
        if (items.length === 0) {
            return null;
        }
        const file = await this.packager.getTempFile(".xml");
        await fs_extra_1.outputFile(file, '<?xml version="1.0" encoding="utf-8"?>\n<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">\n' + items.join("\n") + "\n</mime-info>");
        return file;
    }
    // must be name without spaces and other special characters, but not product name used
    async computeDesktopIcons() {
        var _a, _b, _c;
        const packager = this.packager;
        const { platformSpecificBuildOptions, config } = packager;
        const sources = [platformSpecificBuildOptions.icon, (_b = (_a = config.mac) === null || _a === void 0 ? void 0 : _a.icon) !== null && _b !== void 0 ? _b : config.icon].filter(str => !!str);
        // If no explicit sources are defined, fallback to buildResources directory, then default framework icon
        let fallbackSources = [...builder_util_1.asArray(packager.getDefaultFrameworkIcon())];
        const buildResources = (_c = config.directories) === null || _c === void 0 ? void 0 : _c.buildResources;
        if (buildResources && (await builder_util_1.exists(path_1.join(buildResources, "icons")))) {
            fallbackSources = [buildResources, ...fallbackSources];
        }
        // need to put here and not as default because need to resolve image size
        const result = await packager.resolveIcon(sources, fallbackSources, "set");
        this.maxIconPath = result[result.length - 1].file;
        return result;
    }
    getDescription(options) {
        return options.description || this.packager.appInfo.description;
    }
    async writeDesktopEntry(targetSpecificOptions, exec, destination, extra) {
        const data = await this.computeDesktopEntry(targetSpecificOptions, exec, extra);
        const file = destination || (await this.packager.getTempFile(`${this.packager.appInfo.productFilename}.desktop`));
        await fs_extra_1.outputFile(file, data);
        return file;
    }
    computeDesktopEntry(targetSpecificOptions, exec, extra) {
        if (exec != null && exec.length === 0) {
            throw new Error("Specified exec is empty");
        }
        // https://github.com/electron-userland/electron-builder/issues/3418
        if (targetSpecificOptions.desktop != null && targetSpecificOptions.desktop.Exec != null) {
            throw new Error("Please specify executable name as linux.executableName instead of linux.desktop.Exec");
        }
        const packager = this.packager;
        const appInfo = packager.appInfo;
        const executableArgs = targetSpecificOptions.executableArgs;
        if (exec == null) {
            exec = `${exports.installPrefix}/${appInfo.sanitizedProductName}/${packager.executableName}`;
            if (!/^[/0-9A-Za-z._-]+$/.test(exec)) {
                exec = `"${exec}"`;
            }
            if (executableArgs) {
                exec += " ";
                exec += executableArgs.join(" ");
            }
            // https://specifications.freedesktop.org/desktop-entry-spec/desktop-entry-spec-latest.html#exec-variables
            const execCodes = ["%f", "%u", "%F", "%U"];
            if (executableArgs == null || executableArgs.findIndex(arg => execCodes.includes(arg)) === -1) {
                exec += " %U";
            }
        }
        const desktopMeta = {
            Name: appInfo.productName,
            Exec: exec,
            Terminal: "false",
            Type: "Application",
            Icon: packager.executableName,
            // https://askubuntu.com/questions/367396/what-represent-the-startupwmclass-field-of-a-desktop-file
            // must be set to package.json name (because it is Electron set WM_CLASS)
            // to get WM_CLASS of running window: xprop WM_CLASS
            // StartupWMClass doesn't work for unicode
            // https://github.com/electron/electron/blob/2-0-x/atom/browser/native_window_views.cc#L226
            StartupWMClass: appInfo.productName,
            ...extra,
            ...targetSpecificOptions.desktop,
        };
        const description = this.getDescription(targetSpecificOptions);
        if (!builder_util_1.isEmptyOrSpaces(description)) {
            desktopMeta.Comment = description;
        }
        const mimeTypes = builder_util_1.asArray(targetSpecificOptions.mimeTypes);
        for (const fileAssociation of packager.fileAssociations) {
            if (fileAssociation.mimeType != null) {
                mimeTypes.push(fileAssociation.mimeType);
            }
        }
        for (const protocol of builder_util_1.asArray(packager.config.protocols).concat(builder_util_1.asArray(packager.platformSpecificBuildOptions.protocols))) {
            for (const scheme of builder_util_1.asArray(protocol.schemes)) {
                mimeTypes.push(`x-scheme-handler/${scheme}`);
            }
        }
        if (mimeTypes.length !== 0) {
            desktopMeta.MimeType = mimeTypes.join(";") + ";";
        }
        let category = targetSpecificOptions.category;
        if (builder_util_1.isEmptyOrSpaces(category)) {
            const macCategory = (packager.config.mac || {}).category;
            if (macCategory != null) {
                category = macToLinuxCategory[macCategory];
            }
            if (category == null) {
                // https://github.com/develar/onshape-desktop-shell/issues/48
                if (macCategory != null) {
                    builder_util_1.log.warn({ macCategory }, "cannot map macOS category to Linux. If possible mapping is known for you, please file issue to add it.");
                }
                builder_util_1.log.warn({
                    reason: "linux.category is not set and cannot map from macOS",
                    docs: "https://www.electron.build/configuration/linux",
                }, 'application Linux category is set to default "Utility"');
                category = "Utility";
            }
        }
        desktopMeta.Categories = `${category}${category.endsWith(";") ? "" : ";"}`;
        let data = `[Desktop Entry]`;
        for (const name of Object.keys(desktopMeta)) {
            data += `\n${name}=${desktopMeta[name]}`;
        }
        data += "\n";
        return Promise.resolve(data);
    }
}
exports.LinuxTargetHelper = LinuxTargetHelper;
const macToLinuxCategory = {
    "public.app-category.graphics-design": "Graphics",
    "public.app-category.developer-tools": "Development",
    "public.app-category.education": "Education",
    "public.app-category.games": "Game",
    "public.app-category.video": "Video;AudioVideo",
    "public.app-category.utilities": "Utility",
    "public.app-category.social-networking": "Network;Chat",
    "public.app-category.finance": "Office;Finance",
};
//# sourceMappingURL=LinuxTargetHelper.js.map