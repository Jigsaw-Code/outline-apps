"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOldWin6 = exports.doSign = exports.getCertificateFromStoreInfo = exports.getCertInfo = exports.sign = exports.getSignVendorPath = void 0;
const util_1 = require("builder-util/out/util");
const binDownload_1 = require("../binDownload");
const appBuilder_1 = require("../util/appBuilder");
const bundledTool_1 = require("../util/bundledTool");
const fs_extra_1 = require("fs-extra");
const os = require("os");
const path = require("path");
const platformPackager_1 = require("../platformPackager");
const flags_1 = require("../util/flags");
const vm_1 = require("../vm/vm");
function getSignVendorPath() {
    return binDownload_1.getBin("winCodeSign");
}
exports.getSignVendorPath = getSignVendorPath;
async function sign(options, packager) {
    let hashes = options.options.signingHashAlgorithms;
    // msi does not support dual-signing
    if (options.path.endsWith(".msi")) {
        hashes = [hashes != null && !hashes.includes("sha1") ? "sha256" : "sha1"];
    }
    else if (options.path.endsWith(".appx")) {
        hashes = ["sha256"];
    }
    else if (hashes == null) {
        hashes = ["sha1", "sha256"];
    }
    else {
        hashes = Array.isArray(hashes) ? hashes : [hashes];
    }
    const executor = platformPackager_1.resolveFunction(options.options.sign, "sign") || doSign;
    let isNest = false;
    for (const hash of hashes) {
        const taskConfiguration = { ...options, hash, isNest };
        await Promise.resolve(executor({
            ...taskConfiguration,
            computeSignToolArgs: isWin => computeSignToolArgs(taskConfiguration, isWin),
        }, packager));
        isNest = true;
        if (taskConfiguration.resultOutputPath != null) {
            await fs_extra_1.rename(taskConfiguration.resultOutputPath, options.path);
        }
    }
}
exports.sign = sign;
async function getCertInfo(file, password) {
    let result = null;
    const errorMessagePrefix = "Cannot extract publisher name from code signing certificate. As workaround, set win.publisherName. Error: ";
    try {
        result = await appBuilder_1.executeAppBuilderAsJson(["certificate-info", "--input", file, "--password", password]);
    }
    catch (e) {
        throw new Error(`${errorMessagePrefix}${e.stack || e}`);
    }
    if (result.error != null) {
        // noinspection ExceptionCaughtLocallyJS
        throw new util_1.InvalidConfigurationError(`${errorMessagePrefix}${result.error}`);
    }
    return result;
}
exports.getCertInfo = getCertInfo;
async function getCertificateFromStoreInfo(options, vm) {
    const certificateSubjectName = options.certificateSubjectName;
    const certificateSha1 = options.certificateSha1 ? options.certificateSha1.toUpperCase() : options.certificateSha1;
    // ExcludeProperty doesn't work, so, we cannot exclude RawData, it is ok
    // powershell can return object if the only item
    const rawResult = await vm.exec("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-ChildItem -Recurse Cert: -CodeSigningCert | Select-Object -Property Subject,PSParentPath,Thumbprint | ConvertTo-Json -Compress",
    ]);
    const certList = rawResult.length === 0 ? [] : util_1.asArray(JSON.parse(rawResult));
    for (const certInfo of certList) {
        if ((certificateSubjectName != null && !certInfo.Subject.includes(certificateSubjectName)) ||
            (certificateSha1 != null && certInfo.Thumbprint.toUpperCase() !== certificateSha1)) {
            continue;
        }
        const parentPath = certInfo.PSParentPath;
        const store = parentPath.substring(parentPath.lastIndexOf("\\") + 1);
        util_1.log.debug({ store, PSParentPath: parentPath }, "auto-detect certificate store");
        // https://github.com/electron-userland/electron-builder/issues/1717
        const isLocalMachineStore = parentPath.includes("Certificate::LocalMachine");
        util_1.log.debug(null, "auto-detect using of LocalMachine store");
        return {
            thumbprint: certInfo.Thumbprint,
            subject: certInfo.Subject,
            store,
            isLocalMachineStore,
        };
    }
    throw new Error(`Cannot find certificate ${certificateSubjectName || certificateSha1}, all certs: ${rawResult}`);
}
exports.getCertificateFromStoreInfo = getCertificateFromStoreInfo;
async function doSign(configuration, packager) {
    // https://github.com/electron-userland/electron-builder/pull/1944
    const timeout = parseInt(process.env.SIGNTOOL_TIMEOUT, 10) || 10 * 60 * 1000;
    // unify logic of signtool path location
    const toolInfo = await getToolPath();
    const tool = toolInfo.path;
    // decide runtime argument by cases
    let args;
    let env = process.env;
    let vm;
    if (configuration.path.endsWith(".appx") || !("file" in configuration.cscInfo) /* certificateSubjectName and other such options */) {
        vm = await packager.vm.value;
        args = computeSignToolArgs(configuration, true, vm);
    }
    else {
        vm = new vm_1.VmManager();
        args = configuration.computeSignToolArgs(process.platform === "win32");
        if (toolInfo.env != null) {
            env = toolInfo.env;
        }
    }
    try {
        await vm.exec(tool, args, { timeout, env });
    }
    catch (e) {
        if (e.message.includes("The file is being used by another process") || e.message.includes("The specified timestamp server either could not be reached")) {
            util_1.log.warn(`First attempt to code sign failed, another attempt will be made in 15 seconds: ${e.message}`);
            await new Promise((resolve, reject) => {
                setTimeout(() => {
                    vm.exec(tool, args, { timeout, env }).then(resolve).catch(reject);
                }, 15000);
            });
        }
        throw e;
    }
}
exports.doSign = doSign;
// on windows be aware of http://stackoverflow.com/a/32640183/1910191
function computeSignToolArgs(options, isWin, vm = new vm_1.VmManager()) {
    const inputFile = vm.toVmFile(options.path);
    const outputPath = isWin ? inputFile : getOutputPath(inputFile, options.hash);
    if (!isWin) {
        options.resultOutputPath = outputPath;
    }
    const args = isWin ? ["sign"] : ["-in", inputFile, "-out", outputPath];
    if (process.env.ELECTRON_BUILDER_OFFLINE !== "true") {
        const timestampingServiceUrl = options.options.timeStampServer || "http://timestamp.digicert.com";
        if (isWin) {
            args.push(options.isNest || options.hash === "sha256" ? "/tr" : "/t", options.isNest || options.hash === "sha256" ? options.options.rfc3161TimeStampServer || "http://timestamp.digicert.com" : timestampingServiceUrl);
        }
        else {
            args.push("-t", timestampingServiceUrl);
        }
    }
    const certificateFile = options.cscInfo.file;
    if (certificateFile == null) {
        const cscInfo = options.cscInfo;
        const subjectName = cscInfo.thumbprint;
        if (!isWin) {
            throw new Error(`${subjectName == null ? "certificateSha1" : "certificateSubjectName"} supported only on Windows`);
        }
        args.push("/sha1", cscInfo.thumbprint);
        args.push("/s", cscInfo.store);
        if (cscInfo.isLocalMachineStore) {
            args.push("/sm");
        }
    }
    else {
        const certExtension = path.extname(certificateFile);
        if (certExtension === ".p12" || certExtension === ".pfx") {
            args.push(isWin ? "/f" : "-pkcs12", vm.toVmFile(certificateFile));
        }
        else {
            throw new Error(`Please specify pkcs12 (.p12/.pfx) file, ${certificateFile} is not correct`);
        }
    }
    if (!isWin || options.hash !== "sha1") {
        args.push(isWin ? "/fd" : "-h", options.hash);
        if (isWin && process.env.ELECTRON_BUILDER_OFFLINE !== "true") {
            args.push("/td", "sha256");
        }
    }
    if (options.name) {
        args.push(isWin ? "/d" : "-n", options.name);
    }
    if (options.site) {
        args.push(isWin ? "/du" : "-i", options.site);
    }
    // msi does not support dual-signing
    if (options.isNest) {
        args.push(isWin ? "/as" : "-nest");
    }
    const password = options.cscInfo == null ? null : options.cscInfo.password;
    if (password) {
        args.push(isWin ? "/p" : "-pass", password);
    }
    if (options.options.additionalCertificateFile) {
        args.push(isWin ? "/ac" : "-ac", vm.toVmFile(options.options.additionalCertificateFile));
    }
    const httpsProxyFromEnv = process.env.HTTPS_PROXY;
    if (!isWin && httpsProxyFromEnv != null && httpsProxyFromEnv.length) {
        args.push("-p", httpsProxyFromEnv);
    }
    if (isWin) {
        // https://github.com/electron-userland/electron-builder/issues/2875#issuecomment-387233610
        args.push("/debug");
        // must be last argument
        args.push(inputFile);
    }
    return args;
}
function getOutputPath(inputPath, hash) {
    const extension = path.extname(inputPath);
    return path.join(path.dirname(inputPath), `${path.basename(inputPath, extension)}-signed-${hash}${extension}`);
}
/** @internal */
function isOldWin6() {
    const winVersion = os.release();
    return winVersion.startsWith("6.") && !winVersion.startsWith("6.3");
}
exports.isOldWin6 = isOldWin6;
function getWinSignTool(vendorPath) {
    // use modern signtool on Windows Server 2012 R2 to be able to sign AppX
    if (isOldWin6()) {
        return path.join(vendorPath, "windows-6", "signtool.exe");
    }
    else {
        return path.join(vendorPath, "windows-10", process.arch, "signtool.exe");
    }
}
async function getToolPath() {
    if (flags_1.isUseSystemSigncode()) {
        return { path: "osslsigncode" };
    }
    const result = process.env.SIGNTOOL_PATH;
    if (result) {
        return { path: result };
    }
    const vendorPath = await getSignVendorPath();
    if (process.platform === "win32") {
        // use modern signtool on Windows Server 2012 R2 to be able to sign AppX
        return { path: getWinSignTool(vendorPath) };
    }
    else if (process.platform === "darwin") {
        const toolDirPath = path.join(vendorPath, process.platform, "10.12");
        return {
            path: path.join(toolDirPath, "osslsigncode"),
            env: bundledTool_1.computeToolEnv([path.join(toolDirPath, "lib")]),
        };
    }
    else {
        return { path: path.join(vendorPath, process.platform, "osslsigncode") };
    }
}
//# sourceMappingURL=windowsCodeSign.js.map