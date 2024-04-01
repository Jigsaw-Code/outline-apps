"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLicenseFiles = exports.getNotLocalizedLicenseFile = exports.getLicenseAssets = void 0;
const path = require("path");
const langs_1 = require("./langs");
function getLicenseAssets(fileNames, packager) {
    return fileNames
        .sort((a, b) => {
        const aW = a.includes("_en") ? 0 : 100;
        const bW = b.includes("_en") ? 0 : 100;
        return aW === bW ? a.localeCompare(b) : aW - bW;
    })
        .map(file => {
        let lang = /_([^.]+)\./.exec(file)[1];
        let langWithRegion;
        if (lang.includes("_")) {
            langWithRegion = lang;
            lang = langWithRegion.substring(0, lang.indexOf("_"));
        }
        else {
            lang = lang.toLowerCase();
            langWithRegion = langs_1.toLangWithRegion(lang);
        }
        return { file: path.join(packager.buildResourcesDir, file), lang, langWithRegion, langName: langs_1.langIdToName[lang] };
    });
}
exports.getLicenseAssets = getLicenseAssets;
async function getNotLocalizedLicenseFile(custom, packager, supportedExtension = ["rtf", "txt", "html"]) {
    const possibleFiles = [];
    for (const name of ["license", "eula"]) {
        for (const ext of supportedExtension) {
            possibleFiles.push(`${name}.${ext}`);
            possibleFiles.push(`${name.toUpperCase()}.${ext}`);
            possibleFiles.push(`${name}.${ext.toUpperCase()}`);
            possibleFiles.push(`${name.toUpperCase()}.${ext.toUpperCase()}`);
        }
    }
    return await packager.getResource(custom, ...possibleFiles);
}
exports.getNotLocalizedLicenseFile = getNotLocalizedLicenseFile;
async function getLicenseFiles(packager) {
    return getLicenseAssets((await packager.resourceList).filter(it => {
        const name = it.toLowerCase();
        return (name.startsWith("license_") || name.startsWith("eula_")) && (name.endsWith(".rtf") || name.endsWith(".txt"));
    }), packager);
}
exports.getLicenseFiles = getLicenseFiles;
//# sourceMappingURL=license.js.map