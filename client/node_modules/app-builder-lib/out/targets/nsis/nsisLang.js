"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addCustomMessageFileInclude = exports.createAddLangsMacro = exports.LangConfigurator = void 0;
const builder_util_1 = require("builder-util");
const langs_1 = require("../../util/langs");
const debug_1 = require("debug");
const fs_extra_1 = require("fs-extra");
const js_yaml_1 = require("js-yaml");
const path = require("path");
const nsisUtil_1 = require("./nsisUtil");
const debug = debug_1.default("electron-builder:nsis");
class LangConfigurator {
    constructor(options) {
        const rawList = options.installerLanguages;
        if (options.unicode === false || rawList === null || (Array.isArray(rawList) && rawList.length === 0)) {
            this.isMultiLang = false;
        }
        else {
            this.isMultiLang = options.multiLanguageInstaller !== false;
        }
        if (this.isMultiLang) {
            this.langs = rawList == null ? langs_1.bundledLanguages.slice() : builder_util_1.asArray(rawList).map(it => langs_1.toLangWithRegion(it.replace("-", "_")));
        }
        else {
            this.langs = ["en_US"];
        }
    }
}
exports.LangConfigurator = LangConfigurator;
function createAddLangsMacro(scriptGenerator, langConfigurator) {
    const result = [];
    for (const langWithRegion of langConfigurator.langs) {
        let name;
        if (langWithRegion === "zh_CN") {
            name = "SimpChinese";
        }
        else if (langWithRegion === "zh_TW") {
            name = "TradChinese";
        }
        else if (langWithRegion === "nb_NO") {
            name = "Norwegian";
        }
        else if (langWithRegion === "pt_BR") {
            name = "PortugueseBR";
        }
        else {
            const lang = langWithRegion.substring(0, langWithRegion.indexOf("_"));
            name = langs_1.langIdToName[lang];
            if (name == null) {
                throw new Error(`Language name is unknown for ${lang}`);
            }
            if (name === "Spanish") {
                name = "SpanishInternational";
            }
        }
        result.push(`!insertmacro MUI_LANGUAGE "${name}"`);
    }
    scriptGenerator.macro("addLangs", result);
}
exports.createAddLangsMacro = createAddLangsMacro;
async function writeCustomLangFile(data, packager) {
    const file = await packager.getTempFile("messages.nsh");
    await fs_extra_1.outputFile(file, data);
    return file;
}
async function addCustomMessageFileInclude(input, packager, scriptGenerator, langConfigurator) {
    const data = js_yaml_1.load(await fs_extra_1.readFile(path.join(nsisUtil_1.nsisTemplatesDir, input), "utf-8"));
    const instructions = computeCustomMessageTranslations(data, langConfigurator).join("\n");
    debug(instructions);
    scriptGenerator.include(await writeCustomLangFile(instructions, packager));
}
exports.addCustomMessageFileInclude = addCustomMessageFileInclude;
function computeCustomMessageTranslations(messages, langConfigurator) {
    const result = [];
    const includedLangs = new Set(langConfigurator.langs);
    for (const messageId of Object.keys(messages)) {
        const langToTranslations = messages[messageId];
        const unspecifiedLangs = new Set(langConfigurator.langs);
        for (const lang of Object.keys(langToTranslations)) {
            const langWithRegion = langs_1.toLangWithRegion(lang);
            if (!includedLangs.has(langWithRegion)) {
                continue;
            }
            const value = langToTranslations[lang];
            if (value == null) {
                throw new Error(`${messageId} not specified for ${lang}`);
            }
            result.push(`LangString ${messageId} ${langs_1.lcid[langWithRegion]} "${value.replace(/\n/g, "$\\r$\\n")}"`);
            unspecifiedLangs.delete(langWithRegion);
        }
        if (langConfigurator.isMultiLang) {
            const defaultTranslation = langToTranslations.en.replace(/\n/g, "$\\r$\\n");
            for (const langWithRegion of unspecifiedLangs) {
                result.push(`LangString ${messageId} ${langs_1.lcid[langWithRegion]} "${defaultTranslation}"`);
            }
        }
    }
    return result;
}
//# sourceMappingURL=nsisLang.js.map