/// <reference types="node" />
import { Arch } from "builder-util";
import { GithubOptions } from "builder-util-runtime";
import { ClientRequest } from "http";
import { Lazy } from "lazy-val";
import { HttpPublisher, PublishContext, PublishOptions } from "./publisher";
export interface Release {
    id: number;
    tag_name: string;
    draft: boolean;
    prerelease: boolean;
    published_at: string;
    upload_url: string;
}
export declare class GitHubPublisher extends HttpPublisher {
    private readonly info;
    private readonly version;
    private readonly options;
    private readonly tag;
    readonly _release: Lazy<any>;
    private readonly token;
    readonly providerName = "github";
    private readonly releaseType;
    private releaseLogFields;
    constructor(context: PublishContext, info: GithubOptions, version: string, options?: PublishOptions);
    private getOrCreateRelease;
    private overwriteArtifact;
    protected doUpload(fileName: string, arch: Arch, dataLength: number, requestProcessor: (request: ClientRequest, reject: (error: Error) => void) => void): Promise<any>;
    private doUploadFile;
    private doesErrorMeanAlreadyExists;
    private createRelease;
    getRelease(): Promise<any>;
    deleteRelease(): Promise<any>;
    private githubRequest;
    toString(): string;
}
