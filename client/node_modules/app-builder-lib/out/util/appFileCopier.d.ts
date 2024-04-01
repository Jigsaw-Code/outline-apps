/// <reference types="node" />
import { FileTransformer } from "builder-util/out/fs";
import { Stats } from "fs";
import { FileMatcher } from "../fileMatcher";
import { Packager } from "../packager";
import { PlatformPackager } from "../platformPackager";
export declare function getDestinationPath(file: string, fileSet: ResolvedFileSet): string;
export declare function copyAppFiles(fileSet: ResolvedFileSet, packager: Packager, transformer: FileTransformer): Promise<void>;
export interface ResolvedFileSet {
    src: string;
    destination: string;
    files: Array<string>;
    metadata: Map<string, Stats>;
    transformedFiles?: Map<number, string | Buffer> | null;
}
export declare function transformFiles(transformer: FileTransformer, fileSet: ResolvedFileSet): Promise<void>;
export declare function computeFileSets(matchers: Array<FileMatcher>, transformer: FileTransformer | null, platformPackager: PlatformPackager<any>, isElectronCompile: boolean): Promise<Array<ResolvedFileSet>>;
