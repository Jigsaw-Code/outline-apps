var fs = require('fs')
var bufferEqual = require('buffer-equal')
var FileDescriptorQueue = require('../fs/FileDescriptorQueue')
var closeFilesSync = require('./closeFile').closeFilesSync
var closeFilesAsync = require('./closeFile').closeFilesAsync
var fsPromise = require('../fs/fsPromise')
var BufferPool = require('../fs/BufferPool')

var MAX_CONCURRENT_FILE_COMPARE = 8
var BUF_SIZE = 100000
var fdQueue = new FileDescriptorQueue(MAX_CONCURRENT_FILE_COMPARE * 2)
var bufferPool = new BufferPool(BUF_SIZE, MAX_CONCURRENT_FILE_COMPARE);  // fdQueue guarantees there will be no more than MAX_CONCURRENT_FILE_COMPARE async processes accessing the buffers concurrently


/**
 * Compares two partial buffers.
 */
var compareBuffers = function (buf1, buf2, contentSize) {
    return bufferEqual(buf1.slice(0, contentSize), buf2.slice(0, contentSize))
}

/**
 * Compares two files by content.
 */
var compareSync = function (path1, stat1, path2, stat2, options) {
    var fd1, fd2
    if (stat1.size !== stat2.size) {
        return false
    }
    var bufferPair = bufferPool.allocateBuffers()
    try {
        fd1 = fs.openSync(path1, 'r')
        fd2 = fs.openSync(path2, 'r')
        var buf1 = bufferPair.buf1
        var buf2 = bufferPair.buf2
        var progress = 0
        while (true) {
            var size1 = fs.readSync(fd1, buf1, 0, BUF_SIZE, null)
            var size2 = fs.readSync(fd2, buf2, 0, BUF_SIZE, null)
            if (size1 !== size2) {
                return false
            } else if (size1 === 0) {
                // End of file reached
                return true
            } else if (!compareBuffers(buf1, buf2, size1)) {
                return false
            }
        }
    } finally {
        closeFilesSync(fd1, fd2)
        bufferPool.freeBuffers(bufferPair)
    }
}


/**
 * Compares two files by content
 */
var compareAsync = function (path1, stat1, path2, stat2, options) {
    var fd1, fd2
    var bufferPair
    if (stat1.size !== stat2.size) {
        return Promise.resolve(false)
    }
    return Promise.all([fdQueue.promises.open(path1, 'r'), fdQueue.promises.open(path2, 'r')])
        .then(function (fds) {
            bufferPair = bufferPool.allocateBuffers()
            fd1 = fds[0]
            fd2 = fds[1]
            var buf1 = bufferPair.buf1
            var buf2 = bufferPair.buf2
            var progress = 0
            var compareAsyncInternal = function () {
                return Promise.all([
                    fsPromise.read(fd1, buf1, 0, BUF_SIZE, null),
                    fsPromise.read(fd2, buf2, 0, BUF_SIZE, null)
                ]).then(function (bufferSizes) {
                    var size1 = bufferSizes[0]
                    var size2 = bufferSizes[1]
                    if (size1 !== size2) {
                        return false
                    } else if (size1 === 0) {
                        // End of file reached
                        return true
                    } else if (!compareBuffers(buf1, buf2, size1)) {
                        return false
                    } else {
                        return compareAsyncInternal()
                    }
                })
            }
            return compareAsyncInternal()
        })
        .then(
            // 'finally' polyfill for node 8 and below
            function (res) {
                return finalizeAsync(fd1, fd2, bufferPair).then(() => res)
            },
            function (err) {
                return finalizeAsync(fd1, fd2, bufferPair).then(() => { throw err; })
            }
        )
}

function finalizeAsync(fd1, fd2, bufferPair) {
    bufferPool.freeBuffers(bufferPair)
    return closeFilesAsync(fd1, fd2, fdQueue)
}

module.exports = {
    compareSync: compareSync,
    compareAsync: compareAsync
}
