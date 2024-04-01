"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NsisScriptGenerator = void 0;
class NsisScriptGenerator {
    constructor() {
        this.lines = [];
    }
    addIncludeDir(file) {
        this.lines.push(`!addincludedir "${file}"`);
    }
    addPluginDir(pluginArch, dir) {
        this.lines.push(`!addplugindir /${pluginArch} "${dir}"`);
    }
    include(file) {
        this.lines.push(`!include "${file}"`);
    }
    macro(name, lines) {
        this.lines.push(`!macro ${name}`, `  ${(Array.isArray(lines) ? lines : lines.lines).join("\n  ")}`, `!macroend\n`);
    }
    file(outputName, file) {
        this.lines.push(`File${outputName == null ? "" : ` "/oname=${outputName}"`} "${file}"`);
    }
    insertMacro(name, parameters) {
        this.lines.push(`!insertmacro ${name} ${parameters}`);
    }
    // without -- !!!
    flags(flags) {
        for (const flagName of flags) {
            const variableName = getVarNameForFlag(flagName).replace(/[-]+(\w|$)/g, (m, p1) => p1.toUpperCase());
            this.lines.push(`!macro _${variableName} _a _b _t _f
  $\{StdUtils.TestParameter} $R9 "${flagName}"
  StrCmp "$R9" "true" \`$\{_t}\` \`$\{_f}\`
!macroend
!define ${variableName} \`"" ${variableName} ""\`
`);
        }
    }
    build() {
        return this.lines.join("\n") + "\n";
    }
}
exports.NsisScriptGenerator = NsisScriptGenerator;
function getVarNameForFlag(flagName) {
    if (flagName === "allusers") {
        return "isForAllUsers";
    }
    if (flagName === "currentuser") {
        return "isForCurrentUser";
    }
    return "is" + flagName[0].toUpperCase() + flagName.substring(1);
}
//# sourceMappingURL=nsisScriptGenerator.js.map