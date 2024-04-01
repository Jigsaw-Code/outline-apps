/// <reference types="node" />
import { DebugLogger, ExtraSpawnOptions } from "builder-util";
import { ExecFileOptions, SpawnOptions } from "child_process";
export declare class VmManager {
    get pathSep(): string;
    exec(file: string, args: Array<string>, options?: ExecFileOptions, isLogOutIfDebug?: boolean): Promise<string>;
    spawn(file: string, args: Array<string>, options?: SpawnOptions, extraOptions?: ExtraSpawnOptions): Promise<any>;
    toVmFile(file: string): string;
}
export declare function getWindowsVm(debugLogger: DebugLogger): Promise<VmManager>;
