/// <reference types="node" />
import { Arch } from "builder-util";
import { Hash } from "crypto";
export interface BuildCacheInfo {
    executableDigest: string;
}
export declare class BuildCacheManager {
    private readonly executableFile;
    static VERSION: string;
    readonly cacheDir: string;
    readonly cacheInfoFile: string;
    readonly cacheFile: string;
    cacheInfo: BuildCacheInfo | null;
    private newDigest;
    constructor(outDir: string, executableFile: string, arch: Arch);
    copyIfValid(digest: string): Promise<boolean>;
    save(): Promise<void>;
}
export declare function digest(hash: Hash, files: Array<string>): Promise<string>;
