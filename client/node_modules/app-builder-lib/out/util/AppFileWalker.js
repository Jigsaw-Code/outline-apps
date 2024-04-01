"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppFileWalker = exports.FileCopyHelper = void 0;
const fs_extra_1 = require("fs-extra");
const path = require("path");
const nodeModulesSystemDependentSuffix = `${path.sep}node_modules`;
function addAllPatternIfNeed(matcher) {
    if (!matcher.isSpecifiedAsEmptyArray && (matcher.isEmpty() || matcher.containsOnlyIgnore())) {
        matcher.prependPattern("**/*");
    }
    return matcher;
}
class FileCopyHelper {
    constructor(matcher, filter, packager) {
        this.matcher = matcher;
        this.filter = filter;
        this.packager = packager;
        this.metadata = new Map();
    }
    handleFile(file, parent, fileStat) {
        if (!fileStat.isSymbolicLink()) {
            return null;
        }
        return fs_extra_1.readlink(file).then((linkTarget) => {
            // http://unix.stackexchange.com/questions/105637/is-symlinks-target-relative-to-the-destinations-parent-directory-and-if-so-wh
            return this.handleSymlink(fileStat, file, parent, linkTarget);
        });
    }
    handleSymlink(fileStat, file, parent, linkTarget) {
        const resolvedLinkTarget = path.resolve(parent, linkTarget);
        const link = path.relative(this.matcher.from, resolvedLinkTarget);
        if (link.startsWith("..")) {
            // outside of project, linked module (https://github.com/electron-userland/electron-builder/issues/675)
            return fs_extra_1.stat(resolvedLinkTarget).then(targetFileStat => {
                this.metadata.set(file, targetFileStat);
                return targetFileStat;
            });
        }
        else {
            const s = fileStat;
            s.relativeLink = link;
            s.linkRelativeToFile = path.relative(parent, resolvedLinkTarget);
        }
        return null;
    }
}
exports.FileCopyHelper = FileCopyHelper;
function createAppFilter(matcher, packager) {
    if (packager.areNodeModulesHandledExternally) {
        return matcher.isEmpty() ? null : matcher.createFilter();
    }
    const nodeModulesFilter = (file, fileStat) => {
        return !(fileStat.isDirectory() && file.endsWith(nodeModulesSystemDependentSuffix));
    };
    if (matcher.isEmpty()) {
        return nodeModulesFilter;
    }
    const filter = matcher.createFilter();
    return (file, fileStat) => {
        if (!nodeModulesFilter(file, fileStat)) {
            return !!packager.config.includeSubNodeModules;
        }
        return filter(file, fileStat);
    };
}
/** @internal */
class AppFileWalker extends FileCopyHelper {
    constructor(matcher, packager) {
        super(addAllPatternIfNeed(matcher), createAppFilter(matcher, packager), packager);
        this.matcherFilter = matcher.createFilter();
    }
    // noinspection JSUnusedGlobalSymbols
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    consume(file, fileStat, parent, siblingNames) {
        if (fileStat.isDirectory()) {
            // https://github.com/electron-userland/electron-builder/issues/1539
            // but do not filter if we inside node_modules dir
            // update: solution disabled, node module resolver should support such setup
            if (file.endsWith(nodeModulesSystemDependentSuffix)) {
                if (!this.packager.config.includeSubNodeModules) {
                    const matchesFilter = this.matcherFilter(file, fileStat);
                    if (!matchesFilter) {
                        // Skip the file
                        return false;
                    }
                }
            }
        }
        else {
            // save memory - no need to store stat for directory
            this.metadata.set(file, fileStat);
        }
        return this.handleFile(file, parent, fileStat);
    }
}
exports.AppFileWalker = AppFileWalker;
//# sourceMappingURL=AppFileWalker.js.map