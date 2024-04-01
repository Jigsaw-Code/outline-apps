"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const builder_util_1 = require("builder-util");
const BaseS3Publisher_1 = require("./BaseS3Publisher");
class S3Publisher extends BaseS3Publisher_1.BaseS3Publisher {
    constructor(context, info) {
        super(context, info);
        this.info = info;
        this.providerName = "s3";
    }
    static async checkAndResolveOptions(options, channelFromAppVersion, errorIfCannot) {
        const bucket = options.bucket;
        if (bucket == null) {
            throw new builder_util_1.InvalidConfigurationError(`Please specify "bucket" for "s3" publish provider`);
        }
        if (options.endpoint == null && bucket.includes(".") && options.region == null) {
            // on dotted bucket names, we need to use a path-based endpoint URL. Path-based endpoint URLs need to include the region.
            try {
                options.region = await builder_util_1.executeAppBuilder(["get-bucket-location", "--bucket", bucket]);
            }
            catch (e) {
                if (errorIfCannot) {
                    throw e;
                }
                else {
                    builder_util_1.log.warn(`cannot compute region for bucket (required because on dotted bucket names, we need to use a path-based endpoint URL): ${e}`);
                }
            }
        }
        if (options.channel == null && channelFromAppVersion != null) {
            options.channel = channelFromAppVersion;
        }
        if (options.endpoint != null && options.endpoint.endsWith("/")) {
            ;
            options.endpoint = options.endpoint.slice(0, -1);
        }
    }
    getBucketName() {
        return this.info.bucket;
    }
    configureS3Options(args) {
        super.configureS3Options(args);
        if (this.info.endpoint != null) {
            args.push("--endpoint", this.info.endpoint);
        }
        if (this.info.region != null) {
            args.push("--region", this.info.region);
        }
        if (this.info.storageClass != null) {
            args.push("--storageClass", this.info.storageClass);
        }
        if (this.info.encryption != null) {
            args.push("--encryption", this.info.encryption);
        }
    }
    toString() {
        const result = super.toString();
        const endpoint = this.info.endpoint;
        if (endpoint != null) {
            return result.substring(0, result.length - 1) + `, endpoint: ${endpoint})`;
        }
        return result;
    }
}
exports.default = S3Publisher;
//# sourceMappingURL=s3Publisher.js.map