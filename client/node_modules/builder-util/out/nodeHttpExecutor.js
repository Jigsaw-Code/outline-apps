"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpExecutor = exports.NodeHttpExecutor = void 0;
const builder_util_runtime_1 = require("builder-util-runtime");
const http_1 = require("http");
const http_proxy_agent_1 = require("http-proxy-agent");
const https = require("https");
const https_proxy_agent_1 = require("https-proxy-agent");
class NodeHttpExecutor extends builder_util_runtime_1.HttpExecutor {
    // noinspection JSMethodCanBeStatic
    // noinspection JSUnusedGlobalSymbols
    createRequest(options, callback) {
        if (process.env["https_proxy"] !== undefined && options.protocol === "https:") {
            options.agent = new https_proxy_agent_1.HttpsProxyAgent(process.env["https_proxy"]);
        }
        else if (process.env["http_proxy"] !== undefined && options.protocol === "http:") {
            options.agent = new http_proxy_agent_1.HttpProxyAgent(process.env["http_proxy"]);
        }
        return (options.protocol === "http:" ? http_1.request : https.request)(options, callback);
    }
}
exports.NodeHttpExecutor = NodeHttpExecutor;
exports.httpExecutor = new NodeHttpExecutor();
//# sourceMappingURL=nodeHttpExecutor.js.map