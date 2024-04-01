"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const builder_util_1 = require("builder-util");
const BaseS3Publisher_1 = require("./BaseS3Publisher");
class SpacesPublisher extends BaseS3Publisher_1.BaseS3Publisher {
    constructor(context, info) {
        super(context, info);
        this.info = info;
        this.providerName = "spaces";
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static checkAndResolveOptions(options, channelFromAppVersion, errorIfCannot) {
        if (options.name == null) {
            throw new builder_util_1.InvalidConfigurationError(`Please specify "name" for "spaces" publish provider (see https://www.electron.build/configuration/publish#spacesoptions)`);
        }
        if (options.region == null) {
            throw new builder_util_1.InvalidConfigurationError(`Please specify "region" for "spaces" publish provider (see https://www.electron.build/configuration/publish#spacesoptions)`);
        }
        if (options.channel == null && channelFromAppVersion != null) {
            options.channel = channelFromAppVersion;
        }
        return Promise.resolve();
    }
    getBucketName() {
        return this.info.name;
    }
    configureS3Options(args) {
        super.configureS3Options(args);
        args.push("--endpoint", `${this.info.region}.digitaloceanspaces.com`);
        args.push("--region", this.info.region);
        const accessKey = process.env.DO_KEY_ID;
        const secretKey = process.env.DO_SECRET_KEY;
        if (builder_util_1.isEmptyOrSpaces(accessKey)) {
            throw new builder_util_1.InvalidConfigurationError("Please set env DO_KEY_ID (see https://www.electron.build/configuration/publish#spacesoptions)");
        }
        if (builder_util_1.isEmptyOrSpaces(secretKey)) {
            throw new builder_util_1.InvalidConfigurationError("Please set env DO_SECRET_KEY (see https://www.electron.build/configuration/publish#spacesoptions)");
        }
        args.push("--accessKey", accessKey);
        args.push("--secretKey", secretKey);
    }
}
exports.default = SpacesPublisher;
//# sourceMappingURL=spacesPublisher.js.map