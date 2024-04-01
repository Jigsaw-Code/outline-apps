var fs = require('fs')

var closeFilesSync = function (fd1, fd2) {
    if (fd1) {
        fs.closeSync(fd1)
    }
    if (fd2) {
        fs.closeSync(fd2)
    }
}

var closeFilesAsync = function (fd1, fd2, fdQueue) {
    if (fd1 && fd2) {
        return fdQueue.promises.close(fd1).then(() => fdQueue.promises.close(fd2))
    }
    if (fd1) {
        return fdQueue.promises.close(fd1)
    }
    if (fd2) {
        return fdQueue.promises.close(fd2)
    }
}


module.exports = {
    closeFilesSync: closeFilesSync,
    closeFilesAsync: closeFilesAsync
}
