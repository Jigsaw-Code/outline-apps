"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeToolEnv = exports.computeEnv = void 0;
function computeEnv(oldValue, newValues) {
    const parsedOldValue = oldValue ? oldValue.split(":") : [];
    return newValues
        .concat(parsedOldValue)
        .filter(it => it.length > 0)
        .join(":");
}
exports.computeEnv = computeEnv;
function computeToolEnv(libPath) {
    // noinspection SpellCheckingInspection
    return {
        ...process.env,
        DYLD_LIBRARY_PATH: computeEnv(process.env.DYLD_LIBRARY_PATH, libPath),
    };
}
exports.computeToolEnv = computeToolEnv;
//# sourceMappingURL=bundledTool.js.map