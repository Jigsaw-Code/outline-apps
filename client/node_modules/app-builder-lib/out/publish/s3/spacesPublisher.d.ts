import { SpacesOptions } from "builder-util-runtime";
import { PublishContext } from "electron-publish";
import { BaseS3Publisher } from "./BaseS3Publisher";
export default class SpacesPublisher extends BaseS3Publisher {
    private readonly info;
    readonly providerName = "spaces";
    constructor(context: PublishContext, info: SpacesOptions);
    static checkAndResolveOptions(options: SpacesOptions, channelFromAppVersion: string | null, errorIfCannot: boolean): Promise<void>;
    protected getBucketName(): string;
    protected configureS3Options(args: Array<string>): void;
}
