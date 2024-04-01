"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLinuxToolsPath = void 0;
const binDownload_1 = require("../binDownload");
function getLinuxToolsPath() {
    //noinspection SpellCheckingInspection
    return binDownload_1.getBinFromUrl("linux-tools", "mac-10.12.3", "SQ8fqIRVXuQVWnVgaMTDWyf2TLAJjJYw3tRSqQJECmgF6qdM7Kogfa6KD49RbGzzMYIFca9Uw3MdsxzOPRWcYw==");
}
exports.getLinuxToolsPath = getLinuxToolsPath;
//# sourceMappingURL=tools.js.map