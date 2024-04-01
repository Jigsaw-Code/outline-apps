"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoOpTarget = exports.createCommonTarget = exports.createTargets = exports.computeArchToTargetNamesMap = void 0;
const builder_util_1 = require("builder-util");
const core_1 = require("../core");
const ArchiveTarget_1 = require("./ArchiveTarget");
const archiveTargets = new Set(["zip", "7z", "tar.xz", "tar.lz", "tar.gz", "tar.bz2"]);
function computeArchToTargetNamesMap(raw, platformPackager, platform) {
    for (const targetNames of raw.values()) {
        if (targetNames.length > 0) {
            // https://github.com/electron-userland/electron-builder/issues/1355
            return raw;
        }
    }
    const defaultArchs = raw.size === 0 ? [process.arch] : Array.from(raw.keys()).map(it => builder_util_1.Arch[it]);
    const result = new Map(raw);
    for (const target of builder_util_1.asArray(platformPackager.platformSpecificBuildOptions.target).map(it => (typeof it === "string" ? { target: it } : it))) {
        let name = target.target;
        let archs = target.arch;
        const suffixPos = name.lastIndexOf(":");
        if (suffixPos > 0) {
            name = target.target.substring(0, suffixPos);
            if (archs == null) {
                archs = target.target.substring(suffixPos + 1);
            }
        }
        for (const arch of archs == null ? defaultArchs : builder_util_1.asArray(archs)) {
            builder_util_1.addValue(result, builder_util_1.archFromString(arch), name);
        }
    }
    if (result.size === 0) {
        const defaultTarget = platformPackager.defaultTarget;
        if (raw.size === 0 && platform === core_1.Platform.LINUX && (process.platform === "darwin" || process.platform === "win32")) {
            result.set(builder_util_1.Arch.x64, defaultTarget);
            // cannot enable arm because of native dependencies - e.g. keytar doesn't provide pre-builds for arm
            // result.set(Arch.armv7l, ["snap"])
        }
        else {
            for (const arch of defaultArchs) {
                result.set(builder_util_1.archFromString(arch), defaultTarget);
            }
        }
    }
    return result;
}
exports.computeArchToTargetNamesMap = computeArchToTargetNamesMap;
function createTargets(nameToTarget, rawList, outDir, packager) {
    const result = [];
    const mapper = (name, factory) => {
        let target = nameToTarget.get(name);
        if (target == null) {
            target = factory(outDir);
            nameToTarget.set(name, target);
        }
        result.push(target);
    };
    const targets = normalizeTargets(rawList, packager.defaultTarget);
    packager.createTargets(targets, mapper);
    return result;
}
exports.createTargets = createTargets;
function normalizeTargets(targets, defaultTarget) {
    const list = [];
    for (const t of targets) {
        const name = t.toLowerCase().trim();
        if (name === core_1.DEFAULT_TARGET) {
            list.push(...defaultTarget);
        }
        else {
            list.push(name);
        }
    }
    return list;
}
function createCommonTarget(target, outDir, packager) {
    if (archiveTargets.has(target)) {
        return new ArchiveTarget_1.ArchiveTarget(target, outDir, packager);
    }
    else if (target === core_1.DIR_TARGET) {
        return new NoOpTarget(core_1.DIR_TARGET);
    }
    else {
        throw new Error(`Unknown target: ${target}`);
    }
}
exports.createCommonTarget = createCommonTarget;
class NoOpTarget extends core_1.Target {
    constructor(name) {
        super(name);
        this.options = null;
    }
    get outDir() {
        throw new Error("NoOpTarget");
    }
    // eslint-disable-next-line
    async build(appOutDir, arch) {
        // no build
    }
}
exports.NoOpTarget = NoOpTarget;
//# sourceMappingURL=targetFactory.js.map