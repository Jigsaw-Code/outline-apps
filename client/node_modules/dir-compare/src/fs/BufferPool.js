/**
 * Collection of buffers to be shared between async processes.
 * Avoids allocating buffers each time async process starts.
 * bufSize - size of each buffer
 * bufNo - number of buffers
 * Caller has to make sure no more than bufNo async processes run simultaneously.
 */
function BufferPool(bufSize, bufNo) {
    var bufferPool = []
    for (var i = 0; i < bufNo; i++) {
        bufferPool.push({
            buf1: alloc(bufSize),
            buf2: alloc(bufSize),
            busy: false
        })
    }

    var allocateBuffers = function () {
        for (var j = 0; j < bufNo; j++) {
            var bufferPair = bufferPool[j]
            if (!bufferPair.busy) {
                bufferPair.busy = true
                return bufferPair
            }
        }
        throw new Error('Async buffer limit reached')
    }

    return {
        allocateBuffers: allocateBuffers,
        freeBuffers: freeBuffers
    }

    function freeBuffers(bufferPair) {
        bufferPair.busy = false
    }
}

function alloc(bufSize) {
    if (Buffer.alloc) {
        return Buffer.alloc(bufSize)
    }
    return new Buffer(bufSize)
}

module.exports = BufferPool
