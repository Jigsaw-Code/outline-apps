/// <reference types="node" />
import { Arch } from "builder-util";
import { CancellationToken, PublishProvider } from "builder-util-runtime";
import { Stats } from "fs-extra";
import { ClientRequest } from "http";
import { MultiProgress } from "./multiProgress";
import { ProgressBar } from "./progress";
export declare type PublishPolicy = "onTag" | "onTagOrDraft" | "always" | "never";
export { ProgressCallback } from "./progress";
export interface PublishOptions {
    publish?: PublishPolicy | null;
}
export interface PublishContext {
    readonly cancellationToken: CancellationToken;
    readonly progress: MultiProgress | null;
}
export interface UploadTask {
    file: string;
    fileContent?: Buffer | null;
    arch: Arch | null;
    safeArtifactName?: string | null;
    timeout?: number | null;
}
export declare abstract class Publisher {
    protected readonly context: PublishContext;
    protected constructor(context: PublishContext);
    abstract get providerName(): PublishProvider;
    abstract upload(task: UploadTask): Promise<any>;
    protected createProgressBar(fileName: string, size: number): ProgressBar | null;
    protected createReadStreamAndProgressBar(file: string, fileStat: Stats, progressBar: ProgressBar | null, reject: (error: Error) => void): NodeJS.ReadableStream;
    abstract toString(): string;
}
export declare abstract class HttpPublisher extends Publisher {
    protected readonly context: PublishContext;
    private readonly useSafeArtifactName;
    protected constructor(context: PublishContext, useSafeArtifactName?: boolean);
    upload(task: UploadTask): Promise<any>;
    protected abstract doUpload(fileName: string, arch: Arch, dataLength: number, requestProcessor: (request: ClientRequest, reject: (error: Error) => void) => void, file: string): Promise<any>;
}
export declare function getCiTag(): string | null;
