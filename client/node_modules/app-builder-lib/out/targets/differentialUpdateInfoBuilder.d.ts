import { BlockMapDataHolder, PackageFileInfo } from "builder-util-runtime";
import { Target } from "../core";
import { PlatformPackager } from "../platformPackager";
import { ArchiveOptions } from "./archive";
export declare const BLOCK_MAP_FILE_SUFFIX = ".blockmap";
export declare function createNsisWebDifferentialUpdateInfo(artifactPath: string, packageFiles: {
    [arch: string]: PackageFileInfo;
}): {
    packages: {
        [arch: string]: PackageFileInfo;
    };
} | null;
export declare function configureDifferentialAwareArchiveOptions(archiveOptions: ArchiveOptions): ArchiveOptions;
export declare function appendBlockmap(file: string): Promise<BlockMapDataHolder>;
export declare function createBlockmap(file: string, target: Target, packager: PlatformPackager<any>, safeArtifactName: string | null): Promise<BlockMapDataHolder>;
