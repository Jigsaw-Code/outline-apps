"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFilter = exports.hasMagic = void 0;
const path = require("path");
const fileTransformer_1 = require("../fileTransformer");
/** @internal */
function hasMagic(pattern) {
    const set = pattern.set;
    if (set.length > 1) {
        return true;
    }
    for (const i of set[0]) {
        if (typeof i !== "string") {
            return true;
        }
    }
    return false;
}
exports.hasMagic = hasMagic;
// sometimes, destination may not contain path separator in the end (path to folder), but the src does. So let's ensure paths have path separators in the end
function ensureEndSlash(s) {
    return s.length === 0 || s.endsWith(path.sep) ? s : s + path.sep;
}
function getRelativePath(file, srcWithEndSlash) {
    if (!file.startsWith(srcWithEndSlash)) {
        const index = file.indexOf(fileTransformer_1.NODE_MODULES_PATTERN);
        if (index < 0) {
            throw new Error(`${file} must be under ${srcWithEndSlash}`);
        }
        else {
            return file.substring(index + 1 /* leading slash */);
        }
    }
    let relative = file.substring(srcWithEndSlash.length);
    if (path.sep === "\\") {
        if (relative.startsWith("\\")) {
            // windows problem: double backslash, the above substring call removes root path with a single slash, so here can me some leftovers
            relative = relative.substring(1);
        }
        relative = relative.replace(/\\/g, "/");
    }
    return relative;
}
/** @internal */
function createFilter(src, patterns, excludePatterns) {
    const srcWithEndSlash = ensureEndSlash(src);
    return (file, stat) => {
        if (src === file) {
            return true;
        }
        const relative = getRelativePath(file, srcWithEndSlash);
        // https://github.com/electron-userland/electron-builder/issues/867
        return minimatchAll(relative, patterns, stat) && (excludePatterns == null || stat.isDirectory() || !minimatchAll(relative, excludePatterns, stat));
    };
}
exports.createFilter = createFilter;
// https://github.com/joshwnj/minimatch-all/blob/master/index.js
function minimatchAll(path, patterns, stat) {
    let match = false;
    for (const pattern of patterns) {
        // If we've got a match, only re-test for exclusions.
        // if we don't have a match, only re-test for inclusions.
        if (match !== pattern.negate) {
            continue;
        }
        // partial match — pattern: foo/bar.txt path: foo — we must allow foo
        // use it only for non-negate patterns: const m = new Minimatch("!node_modules/@(electron-download|electron)/**/*", {dot: true }); m.match("node_modules", true) will return false, but must be true
        match = pattern.match(path, stat.isDirectory() && !pattern.negate);
    }
    return match;
}
//# sourceMappingURL=filter.js.map