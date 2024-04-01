"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeModuleCopyHelper = void 0;
const bluebird_lst_1 = require("bluebird-lst");
const fs_1 = require("builder-util/out/fs");
const fs_extra_1 = require("fs-extra");
const path = require("path");
const fileMatcher_1 = require("../fileMatcher");
const platformPackager_1 = require("../platformPackager");
const AppFileWalker_1 = require("./AppFileWalker");
const excludedFiles = new Set([".DS_Store", "node_modules" /* already in the queue */, "CHANGELOG.md", "ChangeLog", "changelog.md", "Changelog.md", "Changelog", "binding.gyp", ".npmignore"].concat(fileMatcher_1.excludedNames.split(",")));
const topLevelExcludedFiles = new Set([
    "test.js",
    "karma.conf.js",
    ".coveralls.yml",
    "README.md",
    "readme.markdown",
    "README",
    "readme.md",
    "Readme.md",
    "Readme",
    "readme",
    "test",
    "__tests__",
    "tests",
    "powered-test",
    "example",
    "examples",
    ".bin",
]);
/** @internal */
class NodeModuleCopyHelper extends AppFileWalker_1.FileCopyHelper {
    constructor(matcher, packager) {
        super(matcher, matcher.isEmpty() ? null : matcher.createFilter(), packager);
    }
    async collectNodeModules(baseDir, moduleNames, nodeModuleExcludedExts) {
        const filter = this.filter;
        const metadata = this.metadata;
        const onNodeModuleFile = platformPackager_1.resolveFunction(this.packager.config.onNodeModuleFile, "onNodeModuleFile");
        const result = [];
        const queue = [];
        for (const moduleName of moduleNames) {
            const tmpPath = baseDir + path.sep + moduleName;
            queue.length = 1;
            // The path should be corrected in Windows that when the moduleName is Scoped packages named.
            const depPath = path.normalize(tmpPath);
            queue[0] = depPath;
            while (queue.length > 0) {
                const dirPath = queue.pop();
                const childNames = await fs_extra_1.readdir(dirPath);
                childNames.sort();
                const isTopLevel = dirPath === depPath;
                const dirs = [];
                // our handler is async, but we should add sorted files, so, we add file to result not in the mapper, but after map
                const sortedFilePaths = await bluebird_lst_1.default.map(childNames, name => {
                    if (onNodeModuleFile != null) {
                        onNodeModuleFile(dirPath + path.sep + name);
                    }
                    if (excludedFiles.has(name) || name.startsWith("._")) {
                        return null;
                    }
                    for (const ext of nodeModuleExcludedExts) {
                        if (name.endsWith(ext)) {
                            return null;
                        }
                    }
                    // noinspection SpellCheckingInspection
                    if (isTopLevel && (topLevelExcludedFiles.has(name) || (moduleName === "libui-node" && (name === "build" || name === "docs" || name === "src")))) {
                        return null;
                    }
                    if (dirPath.endsWith("build")) {
                        if (name === "gyp-mac-tool" || name === "Makefile" || name.endsWith(".mk") || name.endsWith(".gypi") || name.endsWith(".Makefile")) {
                            return null;
                        }
                    }
                    else if (dirPath.endsWith("Release") && (name === ".deps" || name === "obj.target")) {
                        return null;
                    }
                    else if (name === "src" && (dirPath.endsWith("keytar") || dirPath.endsWith("keytar-prebuild"))) {
                        return null;
                    }
                    else if (dirPath.endsWith("lzma-native") && (name === "build" || name === "deps")) {
                        return null;
                    }
                    const filePath = dirPath + path.sep + name;
                    return fs_extra_1.lstat(filePath).then(stat => {
                        if (filter != null && !filter(filePath, stat)) {
                            return null;
                        }
                        if (!stat.isDirectory()) {
                            metadata.set(filePath, stat);
                        }
                        const consumerResult = this.handleFile(filePath, dirPath, stat);
                        if (consumerResult == null) {
                            if (stat.isDirectory()) {
                                dirs.push(name);
                                return null;
                            }
                            else {
                                return filePath;
                            }
                        }
                        else {
                            return consumerResult.then(it => {
                                // asarUtil can return modified stat (symlink handling)
                                if ((it == null ? stat : it).isDirectory()) {
                                    dirs.push(name);
                                    return null;
                                }
                                else {
                                    return filePath;
                                }
                            });
                        }
                    });
                }, fs_1.CONCURRENCY);
                for (const child of sortedFilePaths) {
                    if (child != null) {
                        result.push(child);
                    }
                }
                dirs.sort();
                for (const child of dirs) {
                    queue.push(dirPath + path.sep + child);
                }
            }
        }
        return result;
    }
}
exports.NodeModuleCopyHelper = NodeModuleCopyHelper;
//# sourceMappingURL=NodeModuleCopyHelper.js.map