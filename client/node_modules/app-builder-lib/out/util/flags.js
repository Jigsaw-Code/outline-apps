"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAutoDiscoveryCodeSignIdentity = exports.isBuildCacheEnabled = exports.isUseSystemSigncode = void 0;
const builder_util_1 = require("builder-util");
function isUseSystemSigncode() {
    return builder_util_1.isEnvTrue(process.env.USE_SYSTEM_SIGNCODE);
}
exports.isUseSystemSigncode = isUseSystemSigncode;
function isBuildCacheEnabled() {
    return !builder_util_1.isEnvTrue(process.env.ELECTRON_BUILDER_DISABLE_BUILD_CACHE);
}
exports.isBuildCacheEnabled = isBuildCacheEnabled;
function isAutoDiscoveryCodeSignIdentity() {
    return process.env.CSC_IDENTITY_AUTO_DISCOVERY !== "false";
}
exports.isAutoDiscoveryCodeSignIdentity = isAutoDiscoveryCodeSignIdentity;
//# sourceMappingURL=flags.js.map