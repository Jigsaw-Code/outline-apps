import { S3Options } from "builder-util-runtime";
import { PublishContext } from "electron-publish";
import { BaseS3Publisher } from "./BaseS3Publisher";
export default class S3Publisher extends BaseS3Publisher {
    private readonly info;
    readonly providerName = "s3";
    constructor(context: PublishContext, info: S3Options);
    static checkAndResolveOptions(options: S3Options, channelFromAppVersion: string | null, errorIfCannot: boolean): Promise<void>;
    protected getBucketName(): string;
    protected configureS3Options(args: Array<string>): void;
    toString(): string;
}
