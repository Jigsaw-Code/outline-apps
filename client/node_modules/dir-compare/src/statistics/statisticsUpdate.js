/**
 * Calculates comparison statistics.
 */
module.exports = {
    updateStatisticsBoth: function (entry1, entry2, same, reason, type, statistics, options) {
        same ? statistics.equal++ : statistics.distinct++
        if (type === 'file') {
            same ? statistics.equalFiles++ : statistics.distinctFiles++
        } else if (type === 'directory') {
            same ? statistics.equalDirs++ : statistics.distinctDirs++
        } else if (type === 'broken-link') {
            statistics.brokenLinks.distinctBrokenLinks++
        } else {
            throw new Error('Unexpected type ' + type)
        }

        var isSymlink1 = entry1 ? entry1.isSymlink : false
        var isSymlink2 = entry2 ? entry2.isSymlink : false
        var isSymlink = isSymlink1 || isSymlink2
        if (options.compareSymlink && isSymlink) {
            var symlinks = statistics.symlinks
            if (reason === 'different-symlink') {
                symlinks.distinctSymlinks++
            } else {
                symlinks.equalSymlinks++
            }
        }

    },
    updateStatisticsLeft: function (entry1, type, statistics, options) {
        statistics.left++
        if (type === 'file') {
            statistics.leftFiles++
        } else if (type === 'directory') {
            statistics.leftDirs++
        } else if (type === 'broken-link') {
            statistics.brokenLinks.leftBrokenLinks++
        } else {
            throw new Error('Unexpected type ' + type)
        }

        if (options.compareSymlink && entry1.isSymlink) {
            statistics.symlinks.leftSymlinks++
        }
    },
    updateStatisticsRight: function (entry2, type, statistics, options) {
        statistics.right++
        if (type === 'file') {
            statistics.rightFiles++
        } else if (type === 'directory') {
            statistics.rightDirs++
        } else if (type === 'broken-link') {
            statistics.brokenLinks.rightBrokenLinks++
        } else {
            throw new Error('Unexpected type ' + type)
        }

        if (options.compareSymlink && entry2.isSymlink) {
            statistics.symlinks.rightSymlinks++
        }
    },
}