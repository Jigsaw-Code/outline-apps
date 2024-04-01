/// <reference types="node" />
import { Stats } from "fs";
export declare const MAX_FILE_REQUESTS = 8;
export declare const CONCURRENCY: {
    concurrency: number;
};
export declare type AfterCopyFileTransformer = (file: string) => Promise<void>;
export declare class CopyFileTransformer {
    readonly afterCopyTransformer: AfterCopyFileTransformer;
    constructor(afterCopyTransformer: AfterCopyFileTransformer);
}
export declare type FileTransformer = (file: string) => Promise<null | string | Buffer | CopyFileTransformer> | null | string | Buffer | CopyFileTransformer;
export declare type Filter = (file: string, stat: Stats) => boolean;
export declare function unlinkIfExists(file: string): Promise<void>;
export declare function statOrNull(file: string): Promise<Stats | null>;
export declare function exists(file: string): Promise<boolean>;
export interface FileConsumer {
    consume(file: string, fileStat: Stats, parent: string, siblingNames: Array<string>): any;
    /**
     * @default false
     */
    isIncludeDir?: boolean;
}
/**
 * Returns list of file paths (system-dependent file separator)
 */
export declare function walk(initialDirPath: string, filter?: Filter | null, consumer?: FileConsumer): Promise<Array<string>>;
export declare function copyFile(src: string, dest: string, isEnsureDir?: boolean): Promise<any>;
/**
 * Hard links is used if supported and allowed.
 * File permission is fixed — allow execute for all if owner can, allow read for all if owner can.
 *
 * ensureDir is not called, dest parent dir must exists
 */
export declare function copyOrLinkFile(src: string, dest: string, stats?: Stats | null, isUseHardLink?: boolean, exDevErrorHandler?: (() => boolean) | null): Promise<any>;
export declare class FileCopier {
    private readonly isUseHardLinkFunction?;
    private readonly transformer?;
    isUseHardLink: boolean;
    constructor(isUseHardLinkFunction?: ((file: string) => boolean) | null | undefined, transformer?: FileTransformer | null | undefined);
    copy(src: string, dest: string, stat: Stats | undefined): Promise<void>;
}
export interface CopyDirOptions {
    filter?: Filter | null;
    transformer?: FileTransformer | null;
    isUseHardLink?: ((file: string) => boolean) | null;
}
/**
 * Empty directories is never created.
 * Hard links is used if supported and allowed.
 */
export declare function copyDir(src: string, destination: string, options?: CopyDirOptions): Promise<any>;
export declare const DO_NOT_USE_HARD_LINKS: (file: string) => boolean;
export declare const USE_HARD_LINKS: (file: string) => boolean;
export interface Link {
    readonly link: string;
    readonly file: string;
}
