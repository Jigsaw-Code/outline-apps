/// <reference types="node" />
import { NodeIntegrity } from "./asar";
export interface AsarIntegrityOptions {
    readonly resourcesPath: string;
    readonly resourcesRelativePath: string;
}
export interface HeaderHash {
    algorithm: "SHA256";
    hash: string;
}
export interface AsarIntegrity {
    [key: string]: HeaderHash;
}
export declare function computeData({ resourcesPath, resourcesRelativePath }: AsarIntegrityOptions): Promise<AsarIntegrity>;
export declare function hashFile(file: string, blockSize?: number): Promise<NodeIntegrity>;
export declare function hashFileContents(contents: Buffer | string, blockSize?: number): NodeIntegrity;
