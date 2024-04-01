/// <reference types="node" />
import { Arch } from "builder-util";
import { ClientRequest } from "http";
import { HttpPublisher, PublishContext } from "electron-publish";
import { BitbucketOptions } from "builder-util-runtime/out/publishOptions";
export declare class BitbucketPublisher extends HttpPublisher {
    readonly providerName = "bitbucket";
    readonly hostname = "api.bitbucket.org";
    private readonly info;
    private readonly auth;
    private readonly basePath;
    constructor(context: PublishContext, info: BitbucketOptions);
    protected doUpload(fileName: string, _arch: Arch, _dataLength: number, _requestProcessor: (request: ClientRequest, reject: (error: Error) => void) => void, file: string): Promise<any>;
    deleteRelease(filename: string): Promise<void>;
    toString(): string;
    static convertAppPassword(username: string, token: string): string;
}
