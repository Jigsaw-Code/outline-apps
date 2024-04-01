"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeNodeModuleFileSets = exports.computeFileSets = exports.transformFiles = exports.copyAppFiles = exports.getDestinationPath = exports.ELECTRON_COMPILE_SHIM_FILENAME = void 0;
const bluebird_lst_1 = require("bluebird-lst");
const builder_util_1 = require("builder-util");
const fs_1 = require("builder-util/out/fs");
const promises_1 = require("fs/promises");
const path = require("path");
const unpackDetector_1 = require("../asar/unpackDetector");
const core_1 = require("../core");
const fileMatcher_1 = require("../fileMatcher");
const fileTransformer_1 = require("../fileTransformer");
const AppFileWalker_1 = require("./AppFileWalker");
const NodeModuleCopyHelper_1 = require("./NodeModuleCopyHelper");
const BOWER_COMPONENTS_PATTERN = `${path.sep}bower_components${path.sep}`;
/** @internal */
exports.ELECTRON_COMPILE_SHIM_FILENAME = "__shim.js";
function getDestinationPath(file, fileSet) {
    if (file === fileSet.src) {
        return fileSet.destination;
    }
    else {
        const src = fileSet.src;
        const dest = fileSet.destination;
        if (file.length > src.length && file.startsWith(src) && file[src.length] === path.sep) {
            return dest + file.substring(src.length);
        }
        else {
            // hoisted node_modules
            // not lastIndexOf, to ensure that nested module (top-level module depends on) copied to parent node_modules, not to top-level directory
            // project https://github.com/angexis/punchcontrol/commit/cf929aba55c40d0d8901c54df7945e1d001ce022
            let index = file.indexOf(fileTransformer_1.NODE_MODULES_PATTERN);
            if (index < 0 && file.endsWith(`${path.sep}node_modules`)) {
                index = file.length - 13;
            }
            if (index < 0) {
                throw new Error(`File "${file}" not under the source directory "${fileSet.src}"`);
            }
            return dest + file.substring(index);
        }
    }
}
exports.getDestinationPath = getDestinationPath;
async function copyAppFiles(fileSet, packager, transformer) {
    const metadata = fileSet.metadata;
    // search auto unpacked dir
    const taskManager = new builder_util_1.AsyncTaskManager(packager.cancellationToken);
    const createdParentDirs = new Set();
    const fileCopier = new fs_1.FileCopier(file => {
        // https://github.com/electron-userland/electron-builder/issues/3038
        return !(unpackDetector_1.isLibOrExe(file) || file.endsWith(".node"));
    }, transformer);
    const links = [];
    for (let i = 0, n = fileSet.files.length; i < n; i++) {
        const sourceFile = fileSet.files[i];
        const stat = metadata.get(sourceFile);
        if (stat == null) {
            // dir
            continue;
        }
        const destinationFile = getDestinationPath(sourceFile, fileSet);
        if (stat.isSymbolicLink()) {
            links.push({ file: destinationFile, link: await promises_1.readlink(sourceFile) });
            continue;
        }
        const fileParent = path.dirname(destinationFile);
        if (!createdParentDirs.has(fileParent)) {
            createdParentDirs.add(fileParent);
            await promises_1.mkdir(fileParent, { recursive: true });
        }
        taskManager.addTask(fileCopier.copy(sourceFile, destinationFile, stat));
        if (taskManager.tasks.length > fs_1.MAX_FILE_REQUESTS) {
            await taskManager.awaitTasks();
        }
    }
    if (taskManager.tasks.length > 0) {
        await taskManager.awaitTasks();
    }
    if (links.length > 0) {
        await bluebird_lst_1.default.map(links, it => promises_1.symlink(it.link, it.file), fs_1.CONCURRENCY);
    }
}
exports.copyAppFiles = copyAppFiles;
// used only for ASAR, if no asar, file transformed on the fly
async function transformFiles(transformer, fileSet) {
    if (transformer == null) {
        return;
    }
    let transformedFiles = fileSet.transformedFiles;
    if (fileSet.transformedFiles == null) {
        transformedFiles = new Map();
        fileSet.transformedFiles = transformedFiles;
    }
    const metadata = fileSet.metadata;
    await bluebird_lst_1.default.filter(fileSet.files, (it, index) => {
        const fileStat = metadata.get(it);
        if (fileStat == null || !fileStat.isFile()) {
            return false;
        }
        const transformedValue = transformer(it);
        if (transformedValue == null) {
            return false;
        }
        if (typeof transformedValue === "object" && "then" in transformedValue) {
            return transformedValue.then(it => {
                if (it != null) {
                    transformedFiles.set(index, it);
                }
                return false;
            });
        }
        transformedFiles.set(index, transformedValue);
        return false;
    }, fs_1.CONCURRENCY);
}
exports.transformFiles = transformFiles;
async function computeFileSets(matchers, transformer, platformPackager, isElectronCompile) {
    const fileSets = [];
    const packager = platformPackager.info;
    for (const matcher of matchers) {
        const fileWalker = new AppFileWalker_1.AppFileWalker(matcher, packager);
        const fromStat = await fs_1.statOrNull(matcher.from);
        if (fromStat == null) {
            builder_util_1.log.debug({ directory: matcher.from, reason: "doesn't exist" }, `skipped copying`);
            continue;
        }
        const files = await fs_1.walk(matcher.from, fileWalker.filter, fileWalker);
        const metadata = fileWalker.metadata;
        fileSets.push(validateFileSet({ src: matcher.from, files, metadata, destination: matcher.to }));
    }
    if (isElectronCompile) {
        // cache files should be first (better IO)
        fileSets.unshift(await compileUsingElectronCompile(fileSets[0], packager));
    }
    return fileSets;
}
exports.computeFileSets = computeFileSets;
function getNodeModuleExcludedExts(platformPackager) {
    // do not exclude *.h files (https://github.com/electron-userland/electron-builder/issues/2852)
    const result = [".o", ".obj"].concat(fileMatcher_1.excludedExts.split(",").map(it => `.${it}`));
    if (platformPackager.config.includePdb !== true) {
        result.push(".pdb");
    }
    if (platformPackager.platform !== core_1.Platform.WINDOWS) {
        // https://github.com/electron-userland/electron-builder/issues/1738
        result.push(".dll");
        result.push(".exe");
    }
    return result;
}
function validateFileSet(fileSet) {
    if (fileSet.src == null || fileSet.src.length === 0) {
        throw new Error("fileset src is empty");
    }
    return fileSet;
}
/** @internal */
async function computeNodeModuleFileSets(platformPackager, mainMatcher) {
    const deps = await platformPackager.info.getNodeDependencyInfo(platformPackager.platform).value;
    const nodeModuleExcludedExts = getNodeModuleExcludedExts(platformPackager);
    // serial execution because copyNodeModules is concurrent and so, no need to increase queue/pressure
    const result = new Array();
    let index = 0;
    for (const info of deps) {
        const source = info.dir;
        const destination = getDestinationPath(source, { src: mainMatcher.from, destination: mainMatcher.to, files: [], metadata: null });
        // use main matcher patterns, so, user can exclude some files in such hoisted node modules
        // source here includes node_modules, but pattern base should be without because users expect that pattern "!node_modules/loot-core/src{,/**/*}" will work
        const matcher = new fileMatcher_1.FileMatcher(path.dirname(source), destination, mainMatcher.macroExpander, mainMatcher.patterns);
        const copier = new NodeModuleCopyHelper_1.NodeModuleCopyHelper(matcher, platformPackager.info);
        const files = await copier.collectNodeModules(source, info.deps.map(it => it.name), nodeModuleExcludedExts);
        result[index++] = validateFileSet({ src: source, destination, files, metadata: copier.metadata });
    }
    return result;
}
exports.computeNodeModuleFileSets = computeNodeModuleFileSets;
async function compileUsingElectronCompile(mainFileSet, packager) {
    builder_util_1.log.info("compiling using electron-compile");
    const electronCompileCache = await packager.tempDirManager.getTempDir({ prefix: "electron-compile-cache" });
    const cacheDir = path.join(electronCompileCache, ".cache");
    // clear and create cache dir
    await promises_1.mkdir(cacheDir, { recursive: true });
    const compilerHost = await fileTransformer_1.createElectronCompilerHost(mainFileSet.src, cacheDir);
    const nextSlashIndex = mainFileSet.src.length + 1;
    // pre-compute electron-compile to cache dir - we need to process only subdirectories, not direct files of app dir
    await bluebird_lst_1.default.map(mainFileSet.files, file => {
        if (file.includes(fileTransformer_1.NODE_MODULES_PATTERN) ||
            file.includes(BOWER_COMPONENTS_PATTERN) ||
            !file.includes(path.sep, nextSlashIndex) || // ignore not root files
            !mainFileSet.metadata.get(file).isFile()) {
            return null;
        }
        return compilerHost.compile(file).then(() => null);
    }, fs_1.CONCURRENCY);
    await compilerHost.saveConfiguration();
    const metadata = new Map();
    const cacheFiles = await fs_1.walk(cacheDir, file => !file.startsWith("."), {
        consume: (file, fileStat) => {
            if (fileStat.isFile()) {
                metadata.set(file, fileStat);
            }
            return null;
        },
    });
    // add shim
    const shimPath = `${mainFileSet.src}${path.sep}${exports.ELECTRON_COMPILE_SHIM_FILENAME}`;
    mainFileSet.files.push(shimPath);
    mainFileSet.metadata.set(shimPath, { isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false });
    if (mainFileSet.transformedFiles == null) {
        mainFileSet.transformedFiles = new Map();
    }
    mainFileSet.transformedFiles.set(mainFileSet.files.length - 1, `
'use strict';
require('electron-compile').init(__dirname, require('path').resolve(__dirname, '${packager.metadata.main || "index"}'), true);
`);
    return { src: electronCompileCache, files: cacheFiles, metadata, destination: mainFileSet.destination };
}
//# sourceMappingURL=appFileCopier.js.map