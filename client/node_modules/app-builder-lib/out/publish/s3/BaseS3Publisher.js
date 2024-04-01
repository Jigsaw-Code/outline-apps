"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseS3Publisher = void 0;
const builder_util_1 = require("builder-util");
const electron_publish_1 = require("electron-publish");
const promises_1 = require("fs/promises");
const path = require("path");
class BaseS3Publisher extends electron_publish_1.Publisher {
    constructor(context, options) {
        super(context);
        this.options = options;
    }
    configureS3Options(args) {
        // if explicitly set to null, do not add
        if (this.options.acl !== null) {
            args.push("--acl", this.options.acl || "public-read");
        }
    }
    // http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/s3-example-creating-buckets.html
    async upload(task) {
        const fileName = path.basename(task.file);
        const cancellationToken = this.context.cancellationToken;
        const target = (this.options.path == null ? "" : `${this.options.path}/`) + fileName;
        const args = ["publish-s3", "--bucket", this.getBucketName(), "--key", target, "--file", task.file];
        this.configureS3Options(args);
        if (process.env.__TEST_S3_PUBLISHER__ != null) {
            const testFile = path.join(process.env.__TEST_S3_PUBLISHER__, target);
            await promises_1.mkdir(path.dirname(testFile), { recursive: true });
            await promises_1.symlink(task.file, testFile);
            return;
        }
        // https://github.com/aws/aws-sdk-go/issues/279
        this.createProgressBar(fileName, -1);
        // if (progressBar != null) {
        //   const callback = new ProgressCallback(progressBar)
        //   uploader.on("progress", () => {
        //     if (!cancellationToken.cancelled) {
        //       callback.update(uploader.loaded, uploader.contentLength)
        //     }
        //   })
        // }
        return await cancellationToken.createPromise((resolve, reject, onCancel) => {
            builder_util_1.executeAppBuilder(args, process => {
                onCancel(() => {
                    process.kill("SIGINT");
                });
            })
                .then(() => {
                try {
                    builder_util_1.log.debug({ provider: this.providerName, file: fileName, bucket: this.getBucketName() }, "uploaded");
                }
                finally {
                    resolve(undefined);
                }
            })
                .catch(reject);
        });
    }
    toString() {
        return `${this.providerName} (bucket: ${this.getBucketName()})`;
    }
}
exports.BaseS3Publisher = BaseS3Publisher;
//# sourceMappingURL=BaseS3Publisher.js.map