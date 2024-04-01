"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeygenPublisher = void 0;
const builder_util_1 = require("builder-util");
const nodeHttpExecutor_1 = require("builder-util/out/nodeHttpExecutor");
const electron_publish_1 = require("electron-publish");
const builder_util_runtime_1 = require("builder-util-runtime");
const filename_1 = require("../util/filename");
class KeygenPublisher extends electron_publish_1.HttpPublisher {
    constructor(context, info, version) {
        super(context);
        this.providerName = "keygen";
        this.hostname = "api.keygen.sh";
        const token = process.env.KEYGEN_TOKEN;
        if (builder_util_1.isEmptyOrSpaces(token)) {
            throw new builder_util_1.InvalidConfigurationError(`Keygen token is not set using env "KEYGEN_TOKEN" (see https://www.electron.build/configuration/publish#KeygenOptions)`);
        }
        this.info = info;
        this.auth = `Bearer ${token.trim()}`;
        this.version = version;
        this.basePath = `/v1/accounts/${this.info.account}`;
    }
    doUpload(fileName, _arch, dataLength, requestProcessor, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _file) {
        return builder_util_runtime_1.HttpExecutor.retryOnServerError(async () => {
            const { data, errors } = await this.getOrCreateRelease();
            if (errors) {
                throw new Error(`Keygen - Creating release returned errors: ${JSON.stringify(errors)}`);
            }
            await this.uploadArtifact(data.id, fileName, dataLength, requestProcessor);
            return data.id;
        });
    }
    async uploadArtifact(releaseId, fileName, dataLength, requestProcessor) {
        const { data, errors } = await this.createArtifact(releaseId, fileName, dataLength);
        if (errors) {
            throw new Error(`Keygen - Creating artifact returned errors: ${JSON.stringify(errors)}`);
        }
        // Follow the redirect and upload directly to S3-equivalent storage provider
        const url = new URL(data.links.redirect);
        const upload = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            headers: {
                "Content-Length": dataLength,
            },
            timeout: this.info.timeout || undefined,
        };
        await nodeHttpExecutor_1.httpExecutor.doApiRequest(builder_util_runtime_1.configureRequestOptions(upload, null, "PUT"), this.context.cancellationToken, requestProcessor);
    }
    async createArtifact(releaseId, fileName, dataLength) {
        const upload = {
            hostname: this.hostname,
            path: `${this.basePath}/artifacts`,
            headers: {
                "Content-Type": "application/vnd.api+json",
                Accept: "application/vnd.api+json",
                "Keygen-Version": "1.1",
                Prefer: "no-redirect",
            },
            timeout: this.info.timeout || undefined,
        };
        const data = {
            type: "artifacts",
            attributes: {
                filename: fileName,
                filetype: filename_1.getCompleteExtname(fileName),
                filesize: dataLength,
                platform: this.info.platform,
            },
            relationships: {
                release: {
                    data: {
                        type: "releases",
                        id: releaseId,
                    },
                },
            },
        };
        builder_util_1.log.debug({ data: JSON.stringify(data) }, "Keygen create artifact");
        return builder_util_runtime_1.parseJson(nodeHttpExecutor_1.httpExecutor.request(builder_util_runtime_1.configureRequestOptions(upload, this.auth, "POST"), this.context.cancellationToken, { data }));
    }
    async getOrCreateRelease() {
        try {
            // First, we'll attempt to fetch the release.
            return await this.getRelease();
        }
        catch (e) {
            if (e.statusCode !== 404) {
                throw e;
            }
            try {
                // Next, if the release doesn't exist, we'll attempt to create it.
                return await this.createRelease();
            }
            catch (e) {
                if (e.statusCode !== 409 && e.statusCode !== 422) {
                    throw e;
                }
                // Lastly, when a conflict occurs (in the case of parallel uploads),
                // we'll try to fetch it one last time.
                return this.getRelease();
            }
        }
    }
    async getRelease() {
        const req = {
            hostname: this.hostname,
            path: `${this.basePath}/releases/${this.version}?product=${this.info.product}`,
            headers: {
                Accept: "application/vnd.api+json",
                "Keygen-Version": "1.1",
            },
            timeout: this.info.timeout || undefined,
        };
        return builder_util_runtime_1.parseJson(nodeHttpExecutor_1.httpExecutor.request(builder_util_runtime_1.configureRequestOptions(req, this.auth, "GET"), this.context.cancellationToken, null));
    }
    async createRelease() {
        const req = {
            hostname: this.hostname,
            path: `${this.basePath}/releases`,
            headers: {
                "Content-Type": "application/vnd.api+json",
                Accept: "application/vnd.api+json",
                "Keygen-Version": "1.1",
            },
            timeout: this.info.timeout || undefined,
        };
        const data = {
            type: "releases",
            attributes: {
                version: this.version,
                channel: this.info.channel || "stable",
                status: "PUBLISHED",
            },
            relationships: {
                product: {
                    data: {
                        type: "products",
                        id: this.info.product,
                    },
                },
            },
        };
        builder_util_1.log.debug({ data: JSON.stringify(data) }, "Keygen create release");
        return builder_util_runtime_1.parseJson(nodeHttpExecutor_1.httpExecutor.request(builder_util_runtime_1.configureRequestOptions(req, this.auth, "POST"), this.context.cancellationToken, { data }));
    }
    async deleteRelease(releaseId) {
        const req = {
            hostname: this.hostname,
            path: `${this.basePath}/releases/${releaseId}`,
            headers: {
                Accept: "application/vnd.api+json",
                "Keygen-Version": "1.1",
            },
            timeout: this.info.timeout || undefined,
        };
        await nodeHttpExecutor_1.httpExecutor.request(builder_util_runtime_1.configureRequestOptions(req, this.auth, "DELETE"), this.context.cancellationToken);
    }
    toString() {
        const { account, product, platform } = this.info;
        return `Keygen (account: ${account}, product: ${product}, platform: ${platform}, version: ${this.version})`;
    }
}
exports.KeygenPublisher = KeygenPublisher;
//# sourceMappingURL=KeygenPublisher.js.map