import { Arch } from "builder-util";
import { PkgOptions } from "../options/pkgOptions";
import { Identity } from "../codeSign/macCodeSign";
import { Target } from "../core";
import MacPackager from "../macPackager";
export declare class PkgTarget extends Target {
    private readonly packager;
    readonly outDir: string;
    readonly options: PkgOptions;
    constructor(packager: MacPackager, outDir: string);
    build(appPath: string, arch: Arch): Promise<any>;
    private customizeDistributionConfiguration;
    private buildComponentPackage;
}
export declare function prepareProductBuildArgs(identity: Identity | null, keychain: string | null | undefined): Array<string>;
