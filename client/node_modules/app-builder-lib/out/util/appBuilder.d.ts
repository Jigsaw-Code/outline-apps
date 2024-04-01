/// <reference types="node" />
import { SpawnOptions } from "child_process";
export declare function executeAppBuilderAsJson<T>(args: Array<string>): Promise<T>;
export declare function executeAppBuilderAndWriteJson(args: Array<string>, data: any, extraOptions?: SpawnOptions): Promise<string>;
export declare function objectToArgs(to: Array<string>, argNameToValue: {
    [key: string]: string | null;
}): void;
