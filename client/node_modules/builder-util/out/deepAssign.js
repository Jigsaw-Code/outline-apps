"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepAssign = void 0;
function isObject(x) {
    if (Array.isArray(x)) {
        return false;
    }
    const type = typeof x;
    return type === "object" || type === "function";
}
function assignKey(target, from, key) {
    const value = from[key];
    // https://github.com/electron-userland/electron-builder/pull/562
    if (value === undefined) {
        return;
    }
    const prevValue = target[key];
    if (prevValue == null || value == null || !isObject(prevValue) || !isObject(value)) {
        // Merge arrays.
        if (Array.isArray(prevValue) && Array.isArray(value)) {
            target[key] = Array.from(new Set(prevValue.concat(value)));
        }
        else {
            target[key] = value;
        }
    }
    else {
        target[key] = assign(prevValue, value);
    }
}
function assign(to, from) {
    if (to !== from) {
        for (const key of Object.getOwnPropertyNames(from)) {
            assignKey(to, from, key);
        }
    }
    return to;
}
function deepAssign(target, ...objects) {
    for (const o of objects) {
        if (o != null) {
            assign(target, o);
        }
    }
    return target;
}
exports.deepAssign = deepAssign;
//# sourceMappingURL=deepAssign.js.map