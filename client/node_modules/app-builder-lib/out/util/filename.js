"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompleteExtname = exports.sanitizeFileName = void 0;
// @ts-ignore
const _sanitizeFileName = require("sanitize-filename");
const path = require("path");
function sanitizeFileName(s) {
    return _sanitizeFileName(s);
}
exports.sanitizeFileName = sanitizeFileName;
// Get the filetype from a filename. Returns a string of one or more file extensions,
// e.g. .zip, .dmg, .tar.gz, .tar.bz2, .exe.blockmap. We'd normally use `path.extname()`,
// but it doesn't support multiple extensions, e.g. Foo-1.0.0.dmg.blockmap should be
// .dmg.blockmap, not .blockmap.
function getCompleteExtname(filename) {
    let extname = path.extname(filename);
    switch (extname) {
        // Append leading extension for blockmap filetype
        case ".blockmap": {
            extname = path.extname(filename.replace(extname, "")) + extname;
            break;
        }
        // Append leading extension for known compressed tar formats
        case ".bz2":
        case ".gz":
        case ".lz":
        case ".xz":
        case ".7z": {
            const ext = path.extname(filename.replace(extname, ""));
            if (ext === ".tar") {
                extname = ext + extname;
            }
            break;
        }
    }
    return extname;
}
exports.getCompleteExtname = getCompleteExtname;
//# sourceMappingURL=filename.js.map