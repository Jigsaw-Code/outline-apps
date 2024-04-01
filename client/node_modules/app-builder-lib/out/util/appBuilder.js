"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.objectToArgs = exports.executeAppBuilderAndWriteJson = exports.executeAppBuilderAsJson = void 0;
const builder_util_1 = require("builder-util");
function executeAppBuilderAsJson(args) {
    return builder_util_1.executeAppBuilder(args).then(rawResult => {
        if (rawResult === "") {
            return Object.create(null);
        }
        try {
            return JSON.parse(rawResult);
        }
        catch (e) {
            throw new Error(`Cannot parse result: ${e.message}: "${rawResult}"`);
        }
    });
}
exports.executeAppBuilderAsJson = executeAppBuilderAsJson;
function executeAppBuilderAndWriteJson(args, data, extraOptions = {}) {
    return builder_util_1.executeAppBuilder(args, childProcess => {
        childProcess.stdin.end(JSON.stringify(data));
    }, {
        ...extraOptions,
        stdio: ["pipe", "pipe", process.stdout],
    });
}
exports.executeAppBuilderAndWriteJson = executeAppBuilderAndWriteJson;
function objectToArgs(to, argNameToValue) {
    for (const name of Object.keys(argNameToValue)) {
        const value = argNameToValue[name];
        if (value != null) {
            to.push(`--${name}`, value);
        }
    }
}
exports.objectToArgs = objectToArgs;
//# sourceMappingURL=appBuilder.js.map