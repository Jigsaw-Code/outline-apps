"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashFileContents = exports.hashFile = exports.computeData = void 0;
const bluebird_lst_1 = require("bluebird-lst");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path = require("path");
const asar_1 = require("./asar");
async function computeData({ resourcesPath, resourcesRelativePath }) {
    // sort to produce constant result
    const names = (await promises_1.readdir(resourcesPath)).filter(it => it.endsWith(".asar")).sort();
    const checksums = await bluebird_lst_1.default.map(names, it => hashHeader(path.join(resourcesPath, it)));
    const result = {};
    for (let i = 0; i < names.length; i++) {
        result[path.join(resourcesRelativePath, names[i])] = checksums[i];
    }
    return result;
}
exports.computeData = computeData;
async function hashHeader(file) {
    const hash = crypto_1.createHash("sha256");
    const { header } = await asar_1.readAsarHeader(file);
    hash.update(header);
    return {
        algorithm: "SHA256",
        hash: hash.digest("hex"),
    };
}
function hashFile(file, blockSize = 4 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
        const hash = crypto_1.createHash("sha256");
        const blocks = new Array();
        let blockBytes = 0;
        let blockHash = crypto_1.createHash("sha256");
        function updateBlockHash(chunk) {
            let off = 0;
            while (off < chunk.length) {
                const toHash = Math.min(blockSize - blockBytes, chunk.length - off);
                blockHash.update(chunk.slice(off, off + toHash));
                off += toHash;
                blockBytes += toHash;
                if (blockBytes === blockSize) {
                    blocks.push(blockHash.digest("hex"));
                    blockHash = crypto_1.createHash("sha256");
                    blockBytes = 0;
                }
            }
        }
        fs_1.createReadStream(file)
            .on("data", it => {
            // Note that `it` is a Buffer anyway so this cast is a no-op
            updateBlockHash(Buffer.from(it));
            hash.update(it);
        })
            .on("error", reject)
            .on("end", () => {
            if (blockBytes !== 0) {
                blocks.push(blockHash.digest("hex"));
            }
            resolve({
                algorithm: "SHA256",
                hash: hash.digest("hex"),
                blockSize,
                blocks,
            });
        });
    });
}
exports.hashFile = hashFile;
function hashFileContents(contents, blockSize = 4 * 1024 * 1024) {
    const buffer = Buffer.from(contents);
    const hash = crypto_1.createHash("sha256");
    hash.update(buffer);
    const blocks = new Array();
    for (let off = 0; off < buffer.length; off += blockSize) {
        const blockHash = crypto_1.createHash("sha256");
        blockHash.update(buffer.slice(off, off + blockSize));
        blocks.push(blockHash.digest("hex"));
    }
    return {
        algorithm: "SHA256",
        hash: hash.digest("hex"),
        blockSize,
        blocks,
    };
}
exports.hashFileContents = hashFileContents;
//# sourceMappingURL=integrity.js.map