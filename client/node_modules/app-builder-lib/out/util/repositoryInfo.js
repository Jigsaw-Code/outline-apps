"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRepositoryInfo = void 0;
const promise_1 = require("builder-util/out/promise");
const fs_extra_1 = require("fs-extra");
const hosted_git_info_1 = require("hosted-git-info");
const path = require("path");
function getRepositoryInfo(projectDir, metadata, devMetadata) {
    return _getInfo(projectDir, (devMetadata == null ? null : devMetadata.repository) || (metadata == null ? null : metadata.repository));
}
exports.getRepositoryInfo = getRepositoryInfo;
async function getGitUrlFromGitConfig(projectDir) {
    const data = await promise_1.orNullIfFileNotExist(fs_extra_1.readFile(path.join(projectDir, ".git", "config"), "utf8"));
    if (data == null) {
        return null;
    }
    const conf = data.split(/\r?\n/);
    const i = conf.indexOf('[remote "origin"]');
    if (i !== -1) {
        let u = conf[i + 1];
        if (!/^\s*url =/.exec(u)) {
            u = conf[i + 2];
        }
        if (/^\s*url =/.exec(u)) {
            return u.replace(/^\s*url = /, "");
        }
    }
    return null;
}
async function _getInfo(projectDir, repo) {
    if (repo != null) {
        return parseRepositoryUrl(typeof repo === "string" ? repo : repo.url);
    }
    const slug = process.env.TRAVIS_REPO_SLUG || process.env.APPVEYOR_REPO_NAME;
    if (slug != null) {
        const splitted = slug.split("/");
        return {
            user: splitted[0],
            project: splitted[1],
        };
    }
    const user = process.env.CIRCLE_PROJECT_USERNAME;
    const project = process.env.CIRCLE_PROJECT_REPONAME;
    if (user != null && project != null) {
        return {
            user,
            project,
        };
    }
    const url = await getGitUrlFromGitConfig(projectDir);
    return url == null ? null : parseRepositoryUrl(url);
}
function parseRepositoryUrl(url) {
    const info = hosted_git_info_1.fromUrl(url);
    if (info == null) {
        return null;
    }
    delete info.protocols;
    delete info.treepath;
    delete info.filetemplate;
    delete info.bugstemplate;
    delete info.gittemplate;
    delete info.tarballtemplate;
    delete info.sshtemplate;
    delete info.sshurltemplate;
    delete info.browsetemplate;
    delete info.docstemplate;
    delete info.httpstemplate;
    delete info.shortcuttemplate;
    delete info.pathtemplate;
    delete info.pathmatch;
    delete info.protocols_re;
    delete info.committish;
    delete info.default;
    delete info.opts;
    delete info.browsefiletemplate;
    delete info.auth;
    return info;
}
//# sourceMappingURL=repositoryInfo.js.map