"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newError = exports.asArray = exports.CURRENT_APP_PACKAGE_FILE_NAME = exports.CURRENT_APP_INSTALLER_FILE_NAME = exports.XElement = exports.parseXml = exports.ProgressCallbackTransform = exports.UUID = exports.parseDn = exports.githubUrl = exports.getS3LikeProviderBaseUrl = exports.configureRequestUrl = exports.parseJson = exports.safeStringifyJson = exports.configureRequestOptionsFromUrl = exports.configureRequestOptions = exports.safeGetHeader = exports.DigestTransform = exports.HttpExecutor = exports.createHttpError = exports.HttpError = exports.CancellationError = exports.CancellationToken = void 0;
var CancellationToken_1 = require("./CancellationToken");
Object.defineProperty(exports, "CancellationToken", { enumerable: true, get: function () { return CancellationToken_1.CancellationToken; } });
Object.defineProperty(exports, "CancellationError", { enumerable: true, get: function () { return CancellationToken_1.CancellationError; } });
var httpExecutor_1 = require("./httpExecutor");
Object.defineProperty(exports, "HttpError", { enumerable: true, get: function () { return httpExecutor_1.HttpError; } });
Object.defineProperty(exports, "createHttpError", { enumerable: true, get: function () { return httpExecutor_1.createHttpError; } });
Object.defineProperty(exports, "HttpExecutor", { enumerable: true, get: function () { return httpExecutor_1.HttpExecutor; } });
Object.defineProperty(exports, "DigestTransform", { enumerable: true, get: function () { return httpExecutor_1.DigestTransform; } });
Object.defineProperty(exports, "safeGetHeader", { enumerable: true, get: function () { return httpExecutor_1.safeGetHeader; } });
Object.defineProperty(exports, "configureRequestOptions", { enumerable: true, get: function () { return httpExecutor_1.configureRequestOptions; } });
Object.defineProperty(exports, "configureRequestOptionsFromUrl", { enumerable: true, get: function () { return httpExecutor_1.configureRequestOptionsFromUrl; } });
Object.defineProperty(exports, "safeStringifyJson", { enumerable: true, get: function () { return httpExecutor_1.safeStringifyJson; } });
Object.defineProperty(exports, "parseJson", { enumerable: true, get: function () { return httpExecutor_1.parseJson; } });
Object.defineProperty(exports, "configureRequestUrl", { enumerable: true, get: function () { return httpExecutor_1.configureRequestUrl; } });
var publishOptions_1 = require("./publishOptions");
Object.defineProperty(exports, "getS3LikeProviderBaseUrl", { enumerable: true, get: function () { return publishOptions_1.getS3LikeProviderBaseUrl; } });
Object.defineProperty(exports, "githubUrl", { enumerable: true, get: function () { return publishOptions_1.githubUrl; } });
var rfc2253Parser_1 = require("./rfc2253Parser");
Object.defineProperty(exports, "parseDn", { enumerable: true, get: function () { return rfc2253Parser_1.parseDn; } });
var uuid_1 = require("./uuid");
Object.defineProperty(exports, "UUID", { enumerable: true, get: function () { return uuid_1.UUID; } });
var ProgressCallbackTransform_1 = require("./ProgressCallbackTransform");
Object.defineProperty(exports, "ProgressCallbackTransform", { enumerable: true, get: function () { return ProgressCallbackTransform_1.ProgressCallbackTransform; } });
var xml_1 = require("./xml");
Object.defineProperty(exports, "parseXml", { enumerable: true, get: function () { return xml_1.parseXml; } });
Object.defineProperty(exports, "XElement", { enumerable: true, get: function () { return xml_1.XElement; } });
// nsis
exports.CURRENT_APP_INSTALLER_FILE_NAME = "installer.exe";
// nsis-web
exports.CURRENT_APP_PACKAGE_FILE_NAME = "package.7z";
function asArray(v) {
    if (v == null) {
        return [];
    }
    else if (Array.isArray(v)) {
        return v;
    }
    else {
        return [v];
    }
}
exports.asArray = asArray;
function newError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
}
exports.newError = newError;
//# sourceMappingURL=index.js.map