"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readAsarJson = exports.readAsar = exports.readAsarHeader = exports.AsarFilesystem = exports.Node = void 0;
const chromium_pickle_js_1 = require("chromium-pickle-js");
const fs_extra_1 = require("fs-extra");
const path = require("path");
/** @internal */
class Node {
}
exports.Node = Node;
class AsarFilesystem {
    constructor(src, header = new Node(), headerSize = -1) {
        this.src = src;
        this.header = header;
        this.headerSize = headerSize;
        this.offset = 0;
        if (this.header.files == null) {
            this.header.files = {};
        }
    }
    searchNodeFromDirectory(p, isCreate) {
        let node = this.header;
        for (const dir of p.split(path.sep)) {
            if (dir !== ".") {
                let child = node.files[dir];
                if (child == null) {
                    if (!isCreate) {
                        return null;
                    }
                    child = new Node();
                    child.files = {};
                    node.files[dir] = child;
                }
                node = child;
            }
        }
        return node;
    }
    getOrCreateNode(p) {
        if (p == null || p.length === 0) {
            return this.header;
        }
        const name = path.basename(p);
        const dirNode = this.searchNodeFromDirectory(path.dirname(p), true);
        if (dirNode.files == null) {
            dirNode.files = {};
        }
        let result = dirNode.files[name];
        if (result == null) {
            result = new Node();
            dirNode.files[name] = result;
        }
        return result;
    }
    addFileNode(file, dirNode, size, unpacked, stat, integrity) {
        if (size > 4294967295) {
            throw new Error(`${file}: file size cannot be larger than 4.2GB`);
        }
        const node = new Node();
        node.size = size;
        if (integrity) {
            node.integrity = integrity;
        }
        if (unpacked) {
            node.unpacked = true;
        }
        else {
            // electron expects string
            node.offset = this.offset.toString();
            if (process.platform !== "win32" && stat.mode & 0o100) {
                node.executable = true;
            }
            this.offset += node.size;
        }
        let children = dirNode.files;
        if (children == null) {
            children = {};
            dirNode.files = children;
        }
        children[path.basename(file)] = node;
        return node;
    }
    getNode(p) {
        const node = this.searchNodeFromDirectory(path.dirname(p), false);
        return node.files[path.basename(p)];
    }
    getFile(p, followLinks = true) {
        const info = this.getNode(p);
        // if followLinks is false we don't resolve symlinks
        return followLinks && info.link != null ? this.getFile(info.link) : info;
    }
    async readJson(file) {
        return JSON.parse((await this.readFile(file)).toString());
    }
    readFile(file) {
        return readFileFromAsar(this, file, this.getFile(file));
    }
}
exports.AsarFilesystem = AsarFilesystem;
async function readAsarHeader(archive) {
    const fd = await fs_extra_1.open(archive, "r");
    let size;
    let headerBuf;
    try {
        const sizeBuf = Buffer.allocUnsafe(8);
        if ((await fs_extra_1.read(fd, sizeBuf, 0, 8, null)).bytesRead !== 8) {
            throw new Error("Unable to read header size");
        }
        const sizePickle = chromium_pickle_js_1.createFromBuffer(sizeBuf);
        size = sizePickle.createIterator().readUInt32();
        headerBuf = Buffer.allocUnsafe(size);
        if ((await fs_extra_1.read(fd, headerBuf, 0, size, null)).bytesRead !== size) {
            throw new Error("Unable to read header");
        }
    }
    finally {
        await fs_extra_1.close(fd);
    }
    const headerPickle = chromium_pickle_js_1.createFromBuffer(headerBuf);
    return { header: headerPickle.createIterator().readString(), size };
}
exports.readAsarHeader = readAsarHeader;
async function readAsar(archive) {
    const { header, size } = await readAsarHeader(archive);
    return new AsarFilesystem(archive, JSON.parse(header), size);
}
exports.readAsar = readAsar;
async function readAsarJson(archive, file) {
    const fs = await readAsar(archive);
    return await fs.readJson(file);
}
exports.readAsarJson = readAsarJson;
async function readFileFromAsar(filesystem, filename, info) {
    const size = info.size;
    const buffer = Buffer.allocUnsafe(size);
    if (size <= 0) {
        return buffer;
    }
    if (info.unpacked) {
        return await fs_extra_1.readFile(path.join(`${filesystem.src}.unpacked`, filename));
    }
    const fd = await fs_extra_1.open(filesystem.src, "r");
    try {
        const offset = 8 + filesystem.headerSize + parseInt(info.offset, 10);
        await fs_extra_1.read(fd, buffer, 0, size, offset);
    }
    finally {
        await fs_extra_1.close(fd);
    }
    return buffer;
}
//# sourceMappingURL=asar.js.map