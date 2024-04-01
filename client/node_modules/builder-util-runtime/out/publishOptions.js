"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getS3LikeProviderBaseUrl = exports.githubUrl = void 0;
/** @private */
function githubUrl(options, defaultHost = "github.com") {
    return `${options.protocol || "https"}://${options.host || defaultHost}`;
}
exports.githubUrl = githubUrl;
function getS3LikeProviderBaseUrl(configuration) {
    const provider = configuration.provider;
    if (provider === "s3") {
        return s3Url(configuration);
    }
    if (provider === "spaces") {
        return spacesUrl(configuration);
    }
    throw new Error(`Not supported provider: ${provider}`);
}
exports.getS3LikeProviderBaseUrl = getS3LikeProviderBaseUrl;
function s3Url(options) {
    let url;
    if (options.endpoint != null) {
        url = `${options.endpoint}/${options.bucket}`;
    }
    else if (options.bucket.includes(".")) {
        if (options.region == null) {
            throw new Error(`Bucket name "${options.bucket}" includes a dot, but S3 region is missing`);
        }
        // special case, see http://docs.aws.amazon.com/AmazonS3/latest/dev/UsingBucket.html#access-bucket-intro
        if (options.region === "us-east-1") {
            url = `https://s3.amazonaws.com/${options.bucket}`;
        }
        else {
            url = `https://s3-${options.region}.amazonaws.com/${options.bucket}`;
        }
    }
    else if (options.region === "cn-north-1") {
        url = `https://${options.bucket}.s3.${options.region}.amazonaws.com.cn`;
    }
    else {
        url = `https://${options.bucket}.s3.amazonaws.com`;
    }
    return appendPath(url, options.path);
}
function appendPath(url, p) {
    if (p != null && p.length > 0) {
        if (!p.startsWith("/")) {
            url += "/";
        }
        url += p;
    }
    return url;
}
function spacesUrl(options) {
    if (options.name == null) {
        throw new Error(`name is missing`);
    }
    if (options.region == null) {
        throw new Error(`region is missing`);
    }
    return appendPath(`https://${options.name}.${options.region}.digitaloceanspaces.com`, options.path);
}
//# sourceMappingURL=publishOptions.js.map