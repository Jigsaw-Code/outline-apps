/**
 * Controls creation/completion of global statistics object.
 */
module.exports = {
    initStats(options) {
        var symlinkStatistics = undefined
        if (options.compareSymlink) {
            symlinkStatistics = {
                distinctSymlinks: 0,
                equalSymlinks: 0,
                leftSymlinks: 0,
                rightSymlinks: 0,
                differencesSymlinks: 0,
                totalSymlinks: 0,
            }
        }
        var brokenLinksStatistics = {
            leftBrokenLinks: 0,
            rightBrokenLinks: 0,
            distinctBrokenLinks: 0,
        }
        return {
            distinct: 0,
            equal: 0,
            left: 0,
            right: 0,
            distinctFiles: 0,
            equalFiles: 0,
            leftFiles: 0,
            rightFiles: 0,
            distinctDirs: 0,
            equalDirs: 0,
            leftDirs: 0,
            rightDirs: 0,
            brokenLinks: brokenLinksStatistics,
            symlinks: symlinkStatistics,
            same: undefined
        }
    },

    completeStatistics(statistics, options) {
        statistics.differences = statistics.distinct + statistics.left + statistics.right
        statistics.differencesFiles = statistics.distinctFiles + statistics.leftFiles + statistics.rightFiles
        statistics.differencesDirs = statistics.distinctDirs + statistics.leftDirs + statistics.rightDirs
        statistics.total = statistics.equal + statistics.differences
        statistics.totalFiles = statistics.equalFiles + statistics.differencesFiles
        statistics.totalDirs = statistics.equalDirs + statistics.differencesDirs
        var brokenLInksStats = statistics.brokenLinks
        brokenLInksStats.totalBrokenLinks = brokenLInksStats.leftBrokenLinks + brokenLInksStats.rightBrokenLinks + brokenLInksStats.distinctBrokenLinks
        statistics.same = statistics.differences ? false : true

        if (options.compareSymlink) {
            statistics.symlinks.differencesSymlinks = statistics.symlinks.distinctSymlinks +
                statistics.symlinks.leftSymlinks + statistics.symlinks.rightSymlinks
            statistics.symlinks.totalSymlinks = statistics.symlinks.differencesSymlinks + statistics.symlinks.equalSymlinks
        }
    }

}