"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSelfSignedCert = void 0;
const filename_1 = require("app-builder-lib/out/util/filename");
const builder_util_1 = require("builder-util");
const fs_1 = require("builder-util/out/fs");
const chalk = require("chalk");
const windowsCodeSign_1 = require("app-builder-lib/out/codeSign/windowsCodeSign");
const promises_1 = require("fs/promises");
const path = require("path");
/** @internal */
async function createSelfSignedCert(publisher) {
    const tmpDir = new builder_util_1.TmpDir("create-self-signed-cert");
    const targetDir = process.cwd();
    const tempPrefix = path.join(await tmpDir.getTempDir({ prefix: "self-signed-cert-creator" }), filename_1.sanitizeFileName(publisher));
    const cer = `${tempPrefix}.cer`;
    const pvk = `${tempPrefix}.pvk`;
    builder_util_1.log.info(chalk.bold('When asked to enter a password ("Create Private Key Password"), please select "None".'));
    try {
        await promises_1.mkdir(path.dirname(tempPrefix), { recursive: true });
        const vendorPath = path.join(await windowsCodeSign_1.getSignVendorPath(), "windows-10", process.arch);
        await builder_util_1.exec(path.join(vendorPath, "makecert.exe"), ["-r", "-h", "0", "-n", `CN=${quoteString(publisher)}`, "-eku", "1.3.6.1.5.5.7.3.3", "-pe", "-sv", pvk, cer]);
        const pfx = path.join(targetDir, `${filename_1.sanitizeFileName(publisher)}.pfx`);
        await fs_1.unlinkIfExists(pfx);
        await builder_util_1.exec(path.join(vendorPath, "pvk2pfx.exe"), ["-pvk", pvk, "-spc", cer, "-pfx", pfx]);
        builder_util_1.log.info({ file: pfx }, `created. Please see https://electron.build/code-signing how to use it to sign.`);
        const certLocation = "Cert:\\LocalMachine\\TrustedPeople";
        builder_util_1.log.info({ file: pfx, certLocation }, `importing. Operation will be succeed only if runned from root. Otherwise import file manually.`);
        await builder_util_1.spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Import-PfxCertificate", "-FilePath", `"${pfx}"`, "-CertStoreLocation", certLocation]);
    }
    finally {
        await tmpDir.cleanup();
    }
}
exports.createSelfSignedCert = createSelfSignedCert;
function quoteString(s) {
    if (!s.includes(",") && !s.includes('"')) {
        return s;
    }
    return `"${s.replace(/"/g, '\\"')}"`;
}
//# sourceMappingURL=create-self-signed-cert.js.map