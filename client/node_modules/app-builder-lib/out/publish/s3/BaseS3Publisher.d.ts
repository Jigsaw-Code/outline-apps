import { BaseS3Options } from "builder-util-runtime";
import { PublishContext, Publisher, UploadTask } from "electron-publish";
export declare abstract class BaseS3Publisher extends Publisher {
    private options;
    protected constructor(context: PublishContext, options: BaseS3Options);
    protected abstract getBucketName(): string;
    protected configureS3Options(args: Array<string>): void;
    upload(task: UploadTask): Promise<any>;
    toString(): string;
}
