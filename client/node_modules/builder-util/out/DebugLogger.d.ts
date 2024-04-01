export declare class DebugLogger {
    readonly isEnabled: boolean;
    readonly data: any;
    constructor(isEnabled?: boolean);
    add(key: string, value: any): void;
    save(file: string): Promise<void>;
}
