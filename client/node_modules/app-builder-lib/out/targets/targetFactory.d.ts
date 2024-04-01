import { Arch } from "builder-util";
import { Platform, Target } from "../core";
import { PlatformPackager } from "../platformPackager";
export declare function computeArchToTargetNamesMap(raw: Map<Arch, Array<string>>, platformPackager: PlatformPackager<any>, platform: Platform): Map<Arch, Array<string>>;
export declare function createTargets(nameToTarget: Map<string, Target>, rawList: Array<string>, outDir: string, packager: PlatformPackager<any>): Array<Target>;
export declare function createCommonTarget(target: string, outDir: string, packager: PlatformPackager<any>): Target;
export declare class NoOpTarget extends Target {
    readonly options: null;
    constructor(name: string);
    get outDir(): string;
    build(appOutDir: string, arch: Arch): Promise<any>;
}
