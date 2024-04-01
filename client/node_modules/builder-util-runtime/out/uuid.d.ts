/// <reference types="node" />
export declare class UUID {
    private ascii;
    private readonly binary;
    private readonly version;
    static readonly OID: Buffer;
    constructor(uuid: Buffer | string);
    static v5(name: string | Buffer, namespace: Buffer): any;
    toString(): string;
    inspect(): string;
    static check(uuid: Buffer | string, offset?: number): false | {
        version: undefined;
        variant: string;
        format: string;
    } | {
        version: number;
        variant: string;
        format: string;
    };
    static parse(input: string): Buffer;
}
export declare const nil: UUID;
