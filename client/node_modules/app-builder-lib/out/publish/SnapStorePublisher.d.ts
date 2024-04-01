import { Publisher, UploadTask, PublishContext } from "electron-publish";
import { SnapStoreOptions } from "builder-util-runtime/out/publishOptions";
export declare class SnapStorePublisher extends Publisher {
    private options;
    readonly providerName = "snapStore";
    constructor(context: PublishContext, options: SnapStoreOptions);
    upload(task: UploadTask): Promise<any>;
    toString(): string;
}
