"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeLicensePage = void 0;
const langs_1 = require("../../util/langs");
const license_1 = require("../../util/license");
const path = require("path");
const nsisUtil_1 = require("./nsisUtil");
async function computeLicensePage(packager, options, scriptGenerator, languages) {
    const license = await license_1.getNotLocalizedLicenseFile(options.license, packager);
    if (license != null) {
        let licensePage;
        if (license.endsWith(".html")) {
            licensePage = [
                "!define MUI_PAGE_CUSTOMFUNCTION_SHOW LicenseShow",
                "Function LicenseShow",
                "  FindWindow $R0 `#32770` `` $HWNDPARENT",
                "  GetDlgItem $R0 $R0 1000",
                "EmbedHTML::Load /replace $R0 file://$PLUGINSDIR\\license.html",
                "FunctionEnd",
                `!insertmacro MUI_PAGE_LICENSE "${path.join(nsisUtil_1.nsisTemplatesDir, "empty-license.txt")}"`,
            ];
        }
        else {
            licensePage = [`!insertmacro MUI_PAGE_LICENSE "${license}"`];
        }
        scriptGenerator.macro("licensePage", licensePage);
        if (license.endsWith(".html")) {
            scriptGenerator.macro("addLicenseFiles", [`File /oname=$PLUGINSDIR\\license.html "${license}"`]);
        }
        return;
    }
    const licenseFiles = await license_1.getLicenseFiles(packager);
    if (licenseFiles.length === 0) {
        return;
    }
    const licensePage = [];
    const unspecifiedLangs = new Set(languages);
    let defaultFile = null;
    for (const item of licenseFiles) {
        unspecifiedLangs.delete(item.langWithRegion);
        if (defaultFile == null) {
            defaultFile = item.file;
        }
        licensePage.push(`LicenseLangString MUILicense ${langs_1.lcid[item.langWithRegion] || item.lang} "${item.file}"`);
    }
    for (const l of unspecifiedLangs) {
        licensePage.push(`LicenseLangString MUILicense ${langs_1.lcid[l]} "${defaultFile}"`);
    }
    licensePage.push('!insertmacro MUI_PAGE_LICENSE "$(MUILicense)"');
    scriptGenerator.macro("licensePage", licensePage);
}
exports.computeLicensePage = computeLicensePage;
//# sourceMappingURL=nsisLicense.js.map