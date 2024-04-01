/// <reference types="node" />
import { Transform } from "stream";
import { CancellationToken } from "./CancellationToken";
export interface ProgressInfo {
    total: number;
    delta: number;
    transferred: number;
    percent: number;
    bytesPerSecond: number;
}
export declare class ProgressCallbackTransform extends Transform {
    private readonly total;
    private readonly cancellationToken;
    private readonly onProgress;
    private start;
    private transferred;
    private delta;
    private nextUpdate;
    constructor(total: number, cancellationToken: CancellationToken, onProgress: (info: ProgressInfo) => any);
    _transform(chunk: any, encoding: string, callback: any): void;
    _flush(callback: any): void;
}
