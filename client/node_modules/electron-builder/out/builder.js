"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureBuildCommand = exports.build = exports.createTargets = exports.coerceTypes = exports.normalizeOptions = exports.createYargs = void 0;
const builder_util_1 = require("builder-util");
const chalk = require("chalk");
const app_builder_lib_1 = require("app-builder-lib");
const yargs = require("yargs");
function createYargs() {
    return yargs.parserConfiguration({
        "camel-case-expansion": false,
    });
}
exports.createYargs = createYargs;
/** @private */
function normalizeOptions(args) {
    if (args.targets != null) {
        return args;
    }
    const targets = new Map();
    function processTargets(platform, types) {
        function commonArch(currentIfNotSpecified) {
            const result = Array();
            if (args.x64) {
                result.push(builder_util_1.Arch.x64);
            }
            if (args.armv7l) {
                result.push(builder_util_1.Arch.armv7l);
            }
            if (args.arm64) {
                result.push(builder_util_1.Arch.arm64);
            }
            if (args.ia32) {
                result.push(builder_util_1.Arch.ia32);
            }
            if (args.universal) {
                result.push(builder_util_1.Arch.universal);
            }
            return result.length === 0 && currentIfNotSpecified ? [builder_util_1.archFromString(process.arch)] : result;
        }
        let archToType = targets.get(platform);
        if (archToType == null) {
            archToType = new Map();
            targets.set(platform, archToType);
        }
        if (types.length === 0) {
            const defaultTargetValue = args.dir ? [app_builder_lib_1.DIR_TARGET] : [];
            for (const arch of commonArch(args.dir === true)) {
                archToType.set(arch, defaultTargetValue);
            }
            return;
        }
        for (const type of types) {
            const suffixPos = type.lastIndexOf(":");
            if (suffixPos > 0) {
                builder_util_1.addValue(archToType, builder_util_1.archFromString(type.substring(suffixPos + 1)), type.substring(0, suffixPos));
            }
            else {
                for (const arch of commonArch(true)) {
                    builder_util_1.addValue(archToType, arch, type);
                }
            }
        }
    }
    if (args.mac != null) {
        processTargets(app_builder_lib_1.Platform.MAC, args.mac);
    }
    if (args.linux != null) {
        processTargets(app_builder_lib_1.Platform.LINUX, args.linux);
    }
    if (args.win != null) {
        processTargets(app_builder_lib_1.Platform.WINDOWS, args.win);
    }
    if (targets.size === 0) {
        processTargets(app_builder_lib_1.Platform.current(), []);
    }
    const result = { ...args };
    result.targets = targets;
    delete result.dir;
    delete result.mac;
    delete result.linux;
    delete result.win;
    const r = result;
    delete r.m;
    delete r.o;
    delete r.l;
    delete r.w;
    delete r.windows;
    delete r.macos;
    delete r.$0;
    delete r._;
    delete r.version;
    delete r.help;
    delete r.c;
    delete r.p;
    delete r.pd;
    delete result.ia32;
    delete result.x64;
    delete result.armv7l;
    delete result.arm64;
    delete result.universal;
    let config = result.config;
    // config is array when combining dot-notation values with a config file value
    // https://github.com/electron-userland/electron-builder/issues/2016
    if (Array.isArray(config)) {
        const newConfig = {};
        for (const configItem of config) {
            if (typeof configItem === "object") {
                builder_util_1.deepAssign(newConfig, configItem);
            }
            else if (typeof configItem === "string") {
                newConfig.extends = configItem;
            }
        }
        config = newConfig;
        result.config = newConfig;
    }
    // AJV cannot coerce "null" string to null if string is also allowed (because null string is a valid value)
    if (config != null && typeof config !== "string") {
        if (config.extraMetadata != null) {
            coerceTypes(config.extraMetadata);
        }
        // ability to disable code sign using -c.mac.identity=null
        if (config.mac != null) {
            coerceValue(config.mac, "identity");
        }
        // fix Boolean type by coerceTypes
        if (config.nsis != null) {
            coerceTypes(config.nsis);
        }
        if (config.nsisWeb != null) {
            coerceTypes(config.nsisWeb);
        }
    }
    if ("project" in r && !("projectDir" in result)) {
        result.projectDir = r.project;
    }
    delete r.project;
    return result;
}
exports.normalizeOptions = normalizeOptions;
function coerceValue(host, key) {
    const value = host[key];
    if (value === "true") {
        host[key] = true;
    }
    else if (value === "false") {
        host[key] = false;
    }
    else if (value === "null") {
        host[key] = null;
    }
    else if (key === "version" && typeof value === "number") {
        host[key] = value.toString();
    }
    else if (value != null && typeof value === "object") {
        coerceTypes(value);
    }
}
/** @private */
function coerceTypes(host) {
    for (const key of Object.getOwnPropertyNames(host)) {
        coerceValue(host, key);
    }
    return host;
}
exports.coerceTypes = coerceTypes;
function createTargets(platforms, type, arch) {
    const targets = new Map();
    for (const platform of platforms) {
        const archs = arch === "all" ? (platform === app_builder_lib_1.Platform.MAC ? [builder_util_1.Arch.x64, builder_util_1.Arch.arm64, builder_util_1.Arch.universal] : [builder_util_1.Arch.x64, builder_util_1.Arch.ia32]) : [builder_util_1.archFromString(arch == null ? process.arch : arch)];
        const archToType = new Map();
        targets.set(platform, archToType);
        for (const arch of archs) {
            archToType.set(arch, type == null ? [] : [type]);
        }
    }
    return targets;
}
exports.createTargets = createTargets;
function build(rawOptions) {
    const buildOptions = normalizeOptions(rawOptions || {});
    return app_builder_lib_1.build(buildOptions, new app_builder_lib_1.Packager(buildOptions));
}
exports.build = build;
/**
 * @private
 */
function configureBuildCommand(yargs) {
    const publishGroup = "Publishing:";
    const buildGroup = "Building:";
    return yargs
        .option("mac", {
        group: buildGroup,
        alias: ["m", "o", "macos"],
        description: `Build for macOS, accepts target list (see ${chalk.underline("https://goo.gl/5uHuzj")}).`,
        type: "array",
    })
        .option("linux", {
        group: buildGroup,
        alias: "l",
        description: `Build for Linux, accepts target list (see ${chalk.underline("https://goo.gl/4vwQad")})`,
        type: "array",
    })
        .option("win", {
        group: buildGroup,
        alias: ["w", "windows"],
        description: `Build for Windows, accepts target list (see ${chalk.underline("https://goo.gl/jYsTEJ")})`,
        type: "array",
    })
        .option("x64", {
        group: buildGroup,
        description: "Build for x64",
        type: "boolean",
    })
        .option("ia32", {
        group: buildGroup,
        description: "Build for ia32",
        type: "boolean",
    })
        .option("armv7l", {
        group: buildGroup,
        description: "Build for armv7l",
        type: "boolean",
    })
        .option("arm64", {
        group: buildGroup,
        description: "Build for arm64",
        type: "boolean",
    })
        .option("universal", {
        group: buildGroup,
        description: "Build for universal",
        type: "boolean",
    })
        .option("dir", {
        group: buildGroup,
        description: "Build unpacked dir. Useful to test.",
        type: "boolean",
    })
        .option("publish", {
        group: publishGroup,
        alias: "p",
        description: `Publish artifacts, see ${chalk.underline("https://goo.gl/tSFycD")}`,
        choices: ["onTag", "onTagOrDraft", "always", "never", undefined],
    })
        .option("prepackaged", {
        alias: ["pd"],
        group: buildGroup,
        description: "The path to prepackaged app (to pack in a distributable format)",
    })
        .option("projectDir", {
        alias: ["project"],
        group: buildGroup,
        description: "The path to project directory. Defaults to current working directory.",
    })
        .option("config", {
        alias: ["c"],
        group: buildGroup,
        description: "The path to an electron-builder config. Defaults to `electron-builder.yml` (or `json`, or `json5`), see " + chalk.underline("https://goo.gl/YFRJOM"),
    })
        .group(["help", "version"], "Other:")
        .example("electron-builder -mwl", "build for macOS, Windows and Linux")
        .example("electron-builder --linux deb tar.xz", "build deb and tar.xz for Linux")
        .example("electron-builder --win --ia32", "build for Windows ia32")
        .example("electron-builder -c.extraMetadata.foo=bar", "set package.json property `foo` to `bar`")
        .example("electron-builder --config.nsis.unicode=false", "configure unicode options for NSIS");
}
exports.configureBuildCommand = configureBuildCommand;
//# sourceMappingURL=builder.js.map