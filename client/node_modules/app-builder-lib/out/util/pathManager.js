"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVendorPath = exports.getTemplatePath = void 0;
const path = require("path");
const root = path.join(__dirname, "..", "..");
function getTemplatePath(file) {
    return path.join(root, "templates", file);
}
exports.getTemplatePath = getTemplatePath;
function getVendorPath(file) {
    return file == null ? path.join(root, "vendor") : path.join(root, "vendor", file);
}
exports.getVendorPath = getVendorPath;
//# sourceMappingURL=pathManager.js.map