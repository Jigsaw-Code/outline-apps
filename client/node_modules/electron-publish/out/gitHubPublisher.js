"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubPublisher = void 0;
const builder_util_1 = require("builder-util");
const builder_util_runtime_1 = require("builder-util-runtime");
const nodeHttpExecutor_1 = require("builder-util/out/nodeHttpExecutor");
const lazy_val_1 = require("lazy-val");
const mime = require("mime");
const url_1 = require("url");
const publisher_1 = require("./publisher");
class GitHubPublisher extends publisher_1.HttpPublisher {
    constructor(context, info, version, options = {}) {
        super(context, true);
        this.info = info;
        this.version = version;
        this.options = options;
        this._release = new lazy_val_1.Lazy(() => (this.token === "__test__" ? Promise.resolve(null) : this.getOrCreateRelease()));
        this.providerName = "github";
        this.releaseLogFields = null;
        let token = info.token;
        if (builder_util_1.isEmptyOrSpaces(token)) {
            token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
            if (builder_util_1.isEmptyOrSpaces(token)) {
                throw new builder_util_1.InvalidConfigurationError(`GitHub Personal Access Token is not set, neither programmatically, nor using env "GH_TOKEN"`);
            }
            token = token.trim();
            if (!builder_util_1.isTokenCharValid(token)) {
                throw new builder_util_1.InvalidConfigurationError(`GitHub Personal Access Token (${JSON.stringify(token)}) contains invalid characters, please check env "GH_TOKEN"`);
            }
        }
        this.token = token;
        if (version.startsWith("v")) {
            throw new builder_util_1.InvalidConfigurationError(`Version must not start with "v": ${version}`);
        }
        this.tag = info.vPrefixedTagName === false ? version : `v${version}`;
        if (builder_util_1.isEnvTrue(process.env.EP_DRAFT)) {
            this.releaseType = "draft";
            builder_util_1.log.info({ reason: "env EP_DRAFT is set to true" }, "GitHub provider release type is set to draft");
        }
        else if (builder_util_1.isEnvTrue(process.env.EP_PRE_RELEASE) || builder_util_1.isEnvTrue(process.env.EP_PRELEASE) /* https://github.com/electron-userland/electron-builder/issues/2878 */) {
            this.releaseType = "prerelease";
            builder_util_1.log.info({ reason: "env EP_PRE_RELEASE is set to true" }, "GitHub provider release type is set to prerelease");
        }
        else if (info.releaseType != null) {
            this.releaseType = info.releaseType;
        }
        else if (options.prerelease) {
            this.releaseType = "prerelease";
        }
        else {
            // noinspection PointlessBooleanExpressionJS
            this.releaseType = options.draft === false ? "release" : "draft";
        }
    }
    async getOrCreateRelease() {
        const logFields = {
            tag: this.tag,
            version: this.version,
        };
        // we don't use "Get a release by tag name" because "tag name" means existing git tag, but we draft release and don't create git tag
        const releases = await this.githubRequest(`/repos/${this.info.owner}/${this.info.repo}/releases`, this.token);
        for (const release of releases) {
            if (!(release.tag_name === this.tag || release.tag_name === this.version)) {
                continue;
            }
            if (release.draft) {
                return release;
            }
            // https://github.com/electron-userland/electron-builder/issues/1197
            // https://github.com/electron-userland/electron-builder/issues/2072
            if (this.releaseType === "draft") {
                this.releaseLogFields = {
                    reason: "existing type not compatible with publishing type",
                    ...logFields,
                    existingType: release.prerelease ? "pre-release" : "release",
                    publishingType: this.releaseType,
                };
                builder_util_1.log.warn(this.releaseLogFields, "GitHub release not created");
                return null;
            }
            // https://github.com/electron-userland/electron-builder/issues/1133
            // https://github.com/electron-userland/electron-builder/issues/2074
            // if release created < 2 hours — allow to upload
            const publishedAt = release.published_at == null ? null : Date.parse(release.published_at);
            if (!builder_util_1.isEnvTrue(process.env.EP_GH_IGNORE_TIME) && publishedAt != null && Date.now() - publishedAt > 2 * 3600 * 1000) {
                // https://github.com/electron-userland/electron-builder/issues/1183#issuecomment-275867187
                this.releaseLogFields = {
                    reason: "existing release published more than 2 hours ago",
                    ...logFields,
                    date: new Date(publishedAt).toString(),
                };
                builder_util_1.log.warn(this.releaseLogFields, "GitHub release not created");
                return null;
            }
            return release;
        }
        // https://github.com/electron-userland/electron-builder/issues/1835
        if (this.options.publish === "always" || publisher_1.getCiTag() != null) {
            builder_util_1.log.info({
                reason: "release doesn't exist",
                ...logFields,
            }, `creating GitHub release`);
            return this.createRelease();
        }
        this.releaseLogFields = {
            reason: 'release doesn\'t exist and not created because "publish" is not "always" and build is not on tag',
            ...logFields,
        };
        return null;
    }
    async overwriteArtifact(fileName, release) {
        // delete old artifact and re-upload
        builder_util_1.log.warn({ file: fileName, reason: "already exists on GitHub" }, "overwrite published file");
        const assets = await this.githubRequest(`/repos/${this.info.owner}/${this.info.repo}/releases/${release.id}/assets`, this.token, null);
        for (const asset of assets) {
            if (asset.name === fileName) {
                await this.githubRequest(`/repos/${this.info.owner}/${this.info.repo}/releases/assets/${asset.id}`, this.token, null, "DELETE");
                return;
            }
        }
        builder_util_1.log.debug({ file: fileName, reason: "not found on GitHub" }, "trying to upload again");
    }
    async doUpload(fileName, arch, dataLength, requestProcessor) {
        const release = await this._release.value;
        if (release == null) {
            builder_util_1.log.warn({ file: fileName, ...this.releaseLogFields }, "skipped publishing");
            return;
        }
        const parsedUrl = url_1.parse(`${release.upload_url.substring(0, release.upload_url.indexOf("{"))}?name=${fileName}`);
        return await this.doUploadFile(0, parsedUrl, fileName, dataLength, requestProcessor, release);
    }
    doUploadFile(attemptNumber, parsedUrl, fileName, dataLength, requestProcessor, release) {
        return nodeHttpExecutor_1.httpExecutor
            .doApiRequest(builder_util_runtime_1.configureRequestOptions({
            protocol: parsedUrl.protocol,
            hostname: parsedUrl.hostname,
            path: parsedUrl.path,
            method: "POST",
            headers: {
                accept: "application/vnd.github.v3+json",
                "Content-Type": mime.getType(fileName) || "application/octet-stream",
                "Content-Length": dataLength,
            },
            timeout: this.info.timeout || undefined,
        }, this.token), this.context.cancellationToken, requestProcessor)
            .catch(e => {
            if (attemptNumber > 3) {
                return Promise.reject(e);
            }
            else if (this.doesErrorMeanAlreadyExists(e)) {
                return this.overwriteArtifact(fileName, release).then(() => this.doUploadFile(attemptNumber + 1, parsedUrl, fileName, dataLength, requestProcessor, release));
            }
            else {
                return new Promise((resolve, reject) => {
                    const newAttemptNumber = attemptNumber + 1;
                    setTimeout(() => {
                        this.doUploadFile(newAttemptNumber, parsedUrl, fileName, dataLength, requestProcessor, release).then(resolve).catch(reject);
                    }, newAttemptNumber * 2000);
                });
            }
        });
    }
    doesErrorMeanAlreadyExists(e) {
        if (!e.description) {
            return false;
        }
        const desc = e.description;
        const descIncludesAlreadyExists = (desc.includes("errors") && desc.includes("already_exists")) || (desc.errors && desc.errors.length >= 1 && desc.errors[0].code === "already_exists");
        return e.statusCode === 422 && descIncludesAlreadyExists;
    }
    createRelease() {
        return this.githubRequest(`/repos/${this.info.owner}/${this.info.repo}/releases`, this.token, {
            tag_name: this.tag,
            name: this.version,
            draft: this.releaseType === "draft",
            prerelease: this.releaseType === "prerelease",
        });
    }
    // test only
    //noinspection JSUnusedGlobalSymbols
    async getRelease() {
        return this.githubRequest(`/repos/${this.info.owner}/${this.info.repo}/releases/${(await this._release.value).id}`, this.token);
    }
    //noinspection JSUnusedGlobalSymbols
    async deleteRelease() {
        if (!this._release.hasValue) {
            return;
        }
        const release = await this._release.value;
        for (let i = 0; i < 3; i++) {
            try {
                return await this.githubRequest(`/repos/${this.info.owner}/${this.info.repo}/releases/${release.id}`, this.token, null, "DELETE");
            }
            catch (e) {
                if (e instanceof builder_util_runtime_1.HttpError) {
                    if (e.statusCode === 404) {
                        builder_util_1.log.warn({ releaseId: release.id, reason: "doesn't exist" }, "cannot delete release");
                        return;
                    }
                    else if (e.statusCode === 405 || e.statusCode === 502) {
                        continue;
                    }
                }
                throw e;
            }
        }
        builder_util_1.log.warn({ releaseId: release.id }, "cannot delete release");
    }
    githubRequest(path, token, data = null, method) {
        // host can contains port, but node http doesn't support host as url does
        const baseUrl = url_1.parse(`https://${this.info.host || "api.github.com"}`);
        return builder_util_runtime_1.parseJson(nodeHttpExecutor_1.httpExecutor.request(builder_util_runtime_1.configureRequestOptions({
            protocol: baseUrl.protocol,
            hostname: baseUrl.hostname,
            port: baseUrl.port,
            path: this.info.host != null && this.info.host !== "github.com" ? `/api/v3${path.startsWith("/") ? path : `/${path}`}` : path,
            headers: { accept: "application/vnd.github.v3+json" },
            timeout: this.info.timeout || undefined,
        }, token, method), this.context.cancellationToken, data));
    }
    toString() {
        return `Github (owner: ${this.info.owner}, project: ${this.info.repo}, version: ${this.version})`;
    }
}
exports.GitHubPublisher = GitHubPublisher;
//# sourceMappingURL=gitHubPublisher.js.map