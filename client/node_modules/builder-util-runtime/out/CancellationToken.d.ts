/// <reference types="node" />
import { EventEmitter } from "events";
export declare class CancellationToken extends EventEmitter {
    private parentCancelHandler;
    private _cancelled;
    get cancelled(): boolean;
    private _parent;
    set parent(value: CancellationToken);
    constructor(parent?: CancellationToken);
    cancel(): void;
    private onCancel;
    createPromise<R>(callback: (resolve: (thenableOrResult: R | PromiseLike<R>) => void, reject: (error: Error) => void, onCancel: (callback: () => void) => void) => void): Promise<R>;
    private removeParentCancelHandler;
    dispose(): void;
}
export declare class CancellationError extends Error {
    constructor();
}
