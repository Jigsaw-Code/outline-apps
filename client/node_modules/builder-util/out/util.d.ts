/// <reference types="node" />
import { ChildProcess, ExecFileOptions, SpawnOptions } from "child_process";
import _debug from "debug";
export { safeStringifyJson } from "builder-util-runtime";
export { TmpDir } from "temp-file";
export { log, debug } from "./log";
export { Arch, getArchCliNames, toLinuxArchString, getArchSuffix, ArchType, archFromString, defaultArchFromString } from "./arch";
export { AsyncTaskManager } from "./asyncTaskManager";
export { DebugLogger } from "./DebugLogger";
export { copyFile, exists } from "./fs";
export { asArray } from "builder-util-runtime";
export { deepAssign } from "./deepAssign";
export declare const debug7z: _debug.Debugger;
export declare function serializeToYaml(object: any, skipInvalid?: boolean, noRefs?: boolean): string;
export declare function removePassword(input: string): string;
export declare function exec(file: string, args?: Array<string> | null, options?: ExecFileOptions, isLogOutIfDebug?: boolean): Promise<string>;
export interface ExtraSpawnOptions {
    isPipeInput?: boolean;
}
export declare function doSpawn(command: string, args: Array<string>, options?: SpawnOptions, extraOptions?: ExtraSpawnOptions): ChildProcess;
export declare function spawnAndWrite(command: string, args: Array<string>, data: string, options?: SpawnOptions): Promise<any>;
export declare function spawn(command: string, args?: Array<string> | null, options?: SpawnOptions, extraOptions?: ExtraSpawnOptions): Promise<any>;
export declare class ExecError extends Error {
    readonly exitCode: number;
    alreadyLogged: boolean;
    constructor(command: string, exitCode: number, out: string, errorOut: string, code?: string);
}
declare type Nullish = null | undefined;
export declare function use<T, R>(value: T | Nullish, task: (value: T) => R): R | null;
export declare function isEmptyOrSpaces(s: string | null | undefined): s is "" | null | undefined;
export declare function isTokenCharValid(token: string): boolean;
export declare function addValue<K, T>(map: Map<K, Array<T>>, key: K, value: T): void;
export declare function replaceDefault(inList: Array<string> | null | undefined, defaultList: Array<string>): Array<string>;
export declare function getPlatformIconFileName(value: string | null | undefined, isMac: boolean): string | null | undefined;
export declare function isPullRequest(): boolean | "" | undefined;
export declare function isEnvTrue(value: string | null | undefined): boolean;
export declare class InvalidConfigurationError extends Error {
    constructor(message: string, code?: string);
}
export declare function executeAppBuilder(args: Array<string>, childProcessConsumer?: (childProcess: ChildProcess) => void, extraOptions?: SpawnOptions, maxRetries?: number): Promise<string>;
export declare function retry<T>(task: () => Promise<T>, retriesLeft: number, interval: number): Promise<T>;
