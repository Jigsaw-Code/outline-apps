/// <reference types="node" />
import _debug from "debug";
import WritableStream = NodeJS.WritableStream;
export declare const debug: _debug.Debugger;
export interface Fields {
    [index: string]: any;
}
export declare function setPrinter(value: ((message: string) => void) | null): void;
export declare type LogLevel = "info" | "warn" | "debug" | "notice" | "error";
export declare const PADDING = 2;
export declare class Logger {
    protected readonly stream: WritableStream;
    constructor(stream: WritableStream);
    messageTransformer: (message: string, level: LogLevel) => string;
    filePath(file: string): string;
    get isDebugEnabled(): boolean;
    info(messageOrFields: Fields | null | string, message?: string): void;
    error(messageOrFields: Fields | null | string, message?: string): void;
    warn(messageOrFields: Fields | null | string, message?: string): void;
    debug(fields: Fields | null, message: string): void;
    private doLog;
    private _doLog;
    static createMessage(message: string, fields: Fields | null, level: LogLevel, color: (it: string) => string, messagePadding?: number): string;
    log(message: string): void;
}
export declare const log: Logger;
