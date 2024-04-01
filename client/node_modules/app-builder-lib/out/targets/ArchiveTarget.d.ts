import { Arch } from "builder-util";
import { Target, TargetSpecificOptions } from "../core";
import { PlatformPackager } from "../platformPackager";
export declare class ArchiveTarget extends Target {
    readonly outDir: string;
    private readonly packager;
    private readonly isWriteUpdateInfo;
    readonly options: TargetSpecificOptions;
    constructor(name: string, outDir: string, packager: PlatformPackager<any>, isWriteUpdateInfo?: boolean);
    build(appOutDir: string, arch: Arch): Promise<any>;
}
