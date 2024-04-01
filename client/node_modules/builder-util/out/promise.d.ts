export declare function printErrorAndExit(error: Error): void;
export declare function executeFinally<T>(promise: Promise<T>, task: (isErrorOccurred: boolean) => Promise<any>): Promise<T>;
export declare class NestedError extends Error {
    constructor(errors: Array<Error>, message?: string);
}
export declare function orNullIfFileNotExist<T>(promise: Promise<T>): Promise<T | null>;
export declare function orIfFileNotExist<T>(promise: Promise<T>, fallbackValue: T): Promise<T>;
