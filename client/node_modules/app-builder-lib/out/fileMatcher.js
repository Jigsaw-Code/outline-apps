"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyFiles = exports.getFileMatchers = exports.getNodeModuleFileMatcher = exports.getMainFileMatchers = exports.FileMatcher = exports.excludedExts = exports.excludedNames = void 0;
const bluebird_lst_1 = require("bluebird-lst");
const builder_util_1 = require("builder-util");
const fs_1 = require("builder-util/out/fs");
const promises_1 = require("fs/promises");
const minimatch_1 = require("minimatch");
const path = require("path");
const filter_1 = require("./util/filter");
// https://github.com/electron-userland/electron-builder/issues/733
const minimatchOptions = { dot: true };
// noinspection SpellCheckingInspection
exports.excludedNames = ".git,.hg,.svn,CVS,RCS,SCCS," +
    "__pycache__,.DS_Store,thumbs.db,.gitignore,.gitkeep,.gitattributes,.npmignore," +
    ".idea,.vs,.flowconfig,.jshintrc,.eslintrc,.circleci," +
    ".yarn-integrity,.yarn-metadata.json,yarn-error.log,yarn.lock,package-lock.json,npm-debug.log," +
    "appveyor.yml,.travis.yml,circle.yml,.nyc_output";
exports.excludedExts = "iml,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,suo,xproj,cc,d.ts";
function ensureNoEndSlash(file) {
    if (path.sep !== "/") {
        file = file.replace(/\//g, path.sep);
    }
    if (path.sep !== "\\") {
        file = file.replace(/\\/g, path.sep);
    }
    if (file.endsWith(path.sep)) {
        return file.substring(0, file.length - 1);
    }
    else {
        return file;
    }
}
/** @internal */
class FileMatcher {
    constructor(from, to, macroExpander, patterns) {
        this.macroExpander = macroExpander;
        this.excludePatterns = null;
        this.from = ensureNoEndSlash(macroExpander(from));
        this.to = ensureNoEndSlash(macroExpander(to));
        this.patterns = builder_util_1.asArray(patterns).map(it => this.normalizePattern(it));
        this.isSpecifiedAsEmptyArray = Array.isArray(patterns) && patterns.length === 0;
    }
    normalizePattern(pattern) {
        if (pattern.startsWith("./")) {
            pattern = pattern.substring("./".length);
        }
        return path.posix.normalize(this.macroExpander(pattern.replace(/\\/g, "/")));
    }
    addPattern(pattern) {
        this.patterns.push(this.normalizePattern(pattern));
    }
    prependPattern(pattern) {
        this.patterns.unshift(this.normalizePattern(pattern));
    }
    isEmpty() {
        return this.patterns.length === 0;
    }
    containsOnlyIgnore() {
        return !this.isEmpty() && this.patterns.find(it => !it.startsWith("!")) == null;
    }
    computeParsedPatterns(result, fromDir) {
        const relativeFrom = fromDir == null ? null : path.relative(fromDir, this.from);
        if (this.patterns.length === 0 && relativeFrom != null) {
            // file mappings, from here is a file
            result.push(new minimatch_1.Minimatch(relativeFrom, minimatchOptions));
            return;
        }
        for (let pattern of this.patterns) {
            if (relativeFrom != null) {
                pattern = path.join(relativeFrom, pattern);
            }
            const parsedPattern = new minimatch_1.Minimatch(pattern, minimatchOptions);
            result.push(parsedPattern);
            // do not add if contains dot (possibly file if has extension)
            if (!pattern.includes(".") && !filter_1.hasMagic(parsedPattern)) {
                // https://github.com/electron-userland/electron-builder/issues/545
                // add **/*
                result.push(new minimatch_1.Minimatch(`${pattern}/**/*`, minimatchOptions));
            }
        }
    }
    createFilter() {
        const parsedPatterns = [];
        this.computeParsedPatterns(parsedPatterns);
        return filter_1.createFilter(this.from, parsedPatterns, this.excludePatterns);
    }
    toString() {
        return `from: ${this.from}, to: ${this.to}, patterns: ${this.patterns.join(", ")}`;
    }
}
exports.FileMatcher = FileMatcher;
/** @internal */
function getMainFileMatchers(appDir, destination, macroExpander, platformSpecificBuildOptions, platformPackager, outDir, isElectronCompile) {
    const packager = platformPackager.info;
    const buildResourceDir = path.resolve(packager.projectDir, packager.buildResourcesDir);
    let matchers = packager.isPrepackedAppAsar
        ? null
        : getFileMatchers(packager.config, "files", destination, {
            macroExpander,
            customBuildOptions: platformSpecificBuildOptions,
            globalOutDir: outDir,
            defaultSrc: appDir,
        });
    if (matchers == null) {
        matchers = [new FileMatcher(appDir, destination, macroExpander)];
    }
    const matcher = matchers[0];
    // add default patterns, but only if from equals to app dir
    if (matcher.from !== appDir) {
        return matchers;
    }
    // https://github.com/electron-userland/electron-builder/issues/1741#issuecomment-311111418 so, do not use inclusive patterns
    const patterns = matcher.patterns;
    const customFirstPatterns = [];
    // electron-webpack - we need to copy only package.json and node_modules from root dir (and these files are added by default), so, explicit empty array is specified
    if (!matcher.isSpecifiedAsEmptyArray && (matcher.isEmpty() || matcher.containsOnlyIgnore())) {
        customFirstPatterns.push("**/*");
    }
    else if (!patterns.includes("package.json")) {
        patterns.push("package.json");
    }
    customFirstPatterns.push("!**/node_modules");
    // https://github.com/electron-userland/electron-builder/issues/1482
    const relativeBuildResourceDir = path.relative(matcher.from, buildResourceDir);
    if (relativeBuildResourceDir.length !== 0 && !relativeBuildResourceDir.startsWith(".")) {
        customFirstPatterns.push(`!${relativeBuildResourceDir}{,/**/*}`);
    }
    const relativeOutDir = matcher.normalizePattern(path.relative(packager.projectDir, outDir));
    if (!relativeOutDir.startsWith(".")) {
        customFirstPatterns.push(`!${relativeOutDir}{,/**/*}`);
    }
    // add our default exclusions after last user possibly defined "all"/permissive pattern
    let insertIndex = 0;
    for (let i = patterns.length - 1; i >= 0; i--) {
        if (patterns[i].startsWith("**/")) {
            insertIndex = i + 1;
            break;
        }
    }
    patterns.splice(insertIndex, 0, ...customFirstPatterns);
    patterns.push(`!**/*.{${exports.excludedExts}${packager.config.includePdb === true ? "" : ",pdb"}}`);
    patterns.push("!**/._*");
    patterns.push("!**/electron-builder.{yaml,yml,json,json5,toml}");
    patterns.push(`!**/{${exports.excludedNames}}`);
    if (isElectronCompile) {
        patterns.push("!.cache{,/**/*}");
    }
    patterns.push("!.yarn{,/**/*}");
    // https://github.com/electron-userland/electron-builder/issues/1969
    // exclude ony for app root, use .yarnclean to clean node_modules
    patterns.push("!.editorconfig");
    patterns.push("!.yarnrc.yml");
    const debugLogger = packager.debugLogger;
    if (debugLogger.isEnabled) {
        //tslint:disable-next-line:no-invalid-template-strings
        debugLogger.add(`${macroExpander("${arch}")}.firstOrDefaultFilePatterns`, patterns);
    }
    return matchers;
}
exports.getMainFileMatchers = getMainFileMatchers;
/** @internal */
function getNodeModuleFileMatcher(appDir, destination, macroExpander, platformSpecificBuildOptions, packager) {
    // https://github.com/electron-userland/electron-builder/pull/2948#issuecomment-392241632
    // grab only excludes
    const matcher = new FileMatcher(appDir, destination, macroExpander);
    function addPatterns(patterns) {
        if (patterns == null) {
            return;
        }
        else if (!Array.isArray(patterns)) {
            if (typeof patterns === "string" && patterns.startsWith("!")) {
                matcher.addPattern(patterns);
                return;
            }
            // ignore object form
            return;
        }
        for (const pattern of patterns) {
            if (typeof pattern === "string") {
                if (pattern.startsWith("!")) {
                    matcher.addPattern(pattern);
                }
            }
            else {
                const fileSet = pattern;
                if (fileSet.from == null || fileSet.from === ".") {
                    for (const p of builder_util_1.asArray(fileSet.filter)) {
                        matcher.addPattern(p);
                    }
                }
            }
        }
    }
    addPatterns(packager.config.files);
    addPatterns(platformSpecificBuildOptions.files);
    if (!matcher.isEmpty()) {
        matcher.prependPattern("**/*");
    }
    const debugLogger = packager.debugLogger;
    if (debugLogger.isEnabled) {
        //tslint:disable-next-line:no-invalid-template-strings
        debugLogger.add(`${macroExpander("${arch}")}.nodeModuleFilePatterns`, matcher.patterns);
    }
    return matcher;
}
exports.getNodeModuleFileMatcher = getNodeModuleFileMatcher;
/** @internal */
function getFileMatchers(config, name, defaultDestination, options) {
    const defaultMatcher = new FileMatcher(options.defaultSrc, defaultDestination, options.macroExpander);
    const fileMatchers = [];
    function addPatterns(patterns) {
        if (patterns == null) {
            return;
        }
        else if (!Array.isArray(patterns)) {
            if (typeof patterns === "string") {
                defaultMatcher.addPattern(patterns);
                return;
            }
            patterns = [patterns];
        }
        for (const pattern of patterns) {
            if (typeof pattern === "string") {
                // use normalize to transform ./foo to foo
                defaultMatcher.addPattern(pattern);
            }
            else if (name === "asarUnpack") {
                throw new Error(`Advanced file copying not supported for "${name}"`);
            }
            else {
                const from = pattern.from == null ? options.defaultSrc : path.resolve(options.defaultSrc, pattern.from);
                const to = pattern.to == null ? defaultDestination : path.resolve(defaultDestination, pattern.to);
                fileMatchers.push(new FileMatcher(from, to, options.macroExpander, pattern.filter));
            }
        }
    }
    if (name !== "extraDistFiles") {
        addPatterns(config[name]);
    }
    addPatterns(options.customBuildOptions[name]);
    if (!defaultMatcher.isEmpty()) {
        // default matcher should be first in the array
        fileMatchers.unshift(defaultMatcher);
    }
    // we cannot exclude the whole out dir, because sometimes users want to use some file in the out dir in the patterns
    const relativeOutDir = defaultMatcher.normalizePattern(path.relative(options.defaultSrc, options.globalOutDir));
    if (!relativeOutDir.startsWith(".")) {
        defaultMatcher.addPattern(`!${relativeOutDir}/*-unpacked{,/**/*}`);
    }
    return fileMatchers.length === 0 ? null : fileMatchers;
}
exports.getFileMatchers = getFileMatchers;
/** @internal */
function copyFiles(matchers, transformer, isUseHardLink) {
    if (matchers == null || matchers.length === 0) {
        return Promise.resolve();
    }
    return bluebird_lst_1.default.map(matchers, async (matcher) => {
        const fromStat = await fs_1.statOrNull(matcher.from);
        if (fromStat == null) {
            builder_util_1.log.warn({ from: matcher.from }, `file source doesn't exist`);
            return;
        }
        if (fromStat.isFile()) {
            const toStat = await fs_1.statOrNull(matcher.to);
            // https://github.com/electron-userland/electron-builder/issues/1245
            if (toStat != null && toStat.isDirectory()) {
                return await fs_1.copyOrLinkFile(matcher.from, path.join(matcher.to, path.basename(matcher.from)), fromStat, isUseHardLink);
            }
            await promises_1.mkdir(path.dirname(matcher.to), { recursive: true });
            return await fs_1.copyOrLinkFile(matcher.from, matcher.to, fromStat);
        }
        if (matcher.isEmpty() || matcher.containsOnlyIgnore()) {
            matcher.prependPattern("**/*");
        }
        builder_util_1.log.debug({ matcher }, "copying files using pattern");
        return await fs_1.copyDir(matcher.from, matcher.to, { filter: matcher.createFilter(), transformer, isUseHardLink: isUseHardLink ? fs_1.USE_HARD_LINKS : null });
    });
}
exports.copyFiles = copyFiles;
//# sourceMappingURL=fileMatcher.js.map