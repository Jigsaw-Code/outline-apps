"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugLogger = void 0;
const fs_extra_1 = require("fs-extra");
const util_1 = require("./util");
class DebugLogger {
    constructor(isEnabled = true) {
        this.isEnabled = isEnabled;
        this.data = {};
    }
    add(key, value) {
        if (!this.isEnabled) {
            return;
        }
        const dataPath = key.split(".");
        let o = this.data;
        let lastName = null;
        for (const p of dataPath) {
            if (p === dataPath[dataPath.length - 1]) {
                lastName = p;
                break;
            }
            else {
                if (o[p] == null) {
                    o[p] = Object.create(null);
                }
                else if (typeof o[p] === "string") {
                    o[p] = [o[p]];
                }
                o = o[p];
            }
        }
        if (Array.isArray(o[lastName])) {
            o[lastName] = [...o[lastName], value];
        }
        else {
            o[lastName] = value;
        }
    }
    save(file) {
        // toml and json doesn't correctly output multiline string as multiline
        if (this.isEnabled && Object.keys(this.data).length > 0) {
            return fs_extra_1.outputFile(file, util_1.serializeToYaml(this.data));
        }
        else {
            return Promise.resolve();
        }
    }
}
exports.DebugLogger = DebugLogger;
//# sourceMappingURL=DebugLogger.js.map