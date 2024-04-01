/// <reference types="node" />
import { Arch } from "builder-util";
import { ClientRequest } from "http";
import { HttpPublisher, PublishContext } from "electron-publish";
import { KeygenOptions } from "builder-util-runtime/out/publishOptions";
export interface KeygenError {
    title: string;
    detail: string;
    code: string;
}
export interface KeygenRelease {
    id: string;
    type: "releases";
    attributes: {
        name: string | null;
        description: string | null;
        channel: "stable" | "rc" | "beta" | "alpha" | "dev";
        status: "DRAFT" | "PUBLISHED" | "YANKED";
        tag: string;
        version: string;
        semver: {
            major: number;
            minor: number;
            patch: number;
            prerelease: string | null;
            build: string | null;
        };
        metadata: {
            [s: string]: any;
        };
        created: string;
        updated: string;
        yanked: string | null;
    };
    relationships: {
        account: {
            data: {
                type: "accounts";
                id: string;
            };
        };
        product: {
            data: {
                type: "products";
                id: string;
            };
        };
    };
}
export interface KeygenArtifact {
    id: string;
    type: "artifacts";
    attributes: {
        filename: string;
        filetype: string | null;
        filesize: number | null;
        platform: string | null;
        arch: string | null;
        signature: string | null;
        checksum: string | null;
        status: "WAITING" | "UPLOADED" | "FAILED" | "YANKED";
        metadata: {
            [s: string]: any;
        };
        created: string;
        updated: string;
    };
    relationships: {
        account: {
            data: {
                type: "accounts";
                id: string;
            };
        };
        release: {
            data: {
                type: "releases";
                id: string;
            };
        };
    };
    links: {
        redirect: string;
    };
}
export declare class KeygenPublisher extends HttpPublisher {
    readonly providerName = "keygen";
    readonly hostname = "api.keygen.sh";
    private readonly info;
    private readonly auth;
    private readonly version;
    private readonly basePath;
    constructor(context: PublishContext, info: KeygenOptions, version: string);
    protected doUpload(fileName: string, _arch: Arch, dataLength: number, requestProcessor: (request: ClientRequest, reject: (error: Error) => void) => void, _file: string): Promise<string>;
    private uploadArtifact;
    private createArtifact;
    private getOrCreateRelease;
    private getRelease;
    private createRelease;
    deleteRelease(releaseId: string): Promise<void>;
    toString(): string;
}
