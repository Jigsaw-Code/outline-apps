var util = require('util')
var pathUtils = require('path')
var fs = require('fs')
var compareSyncInternal = require('./compareSync')
var compareAsyncInternal = require('./compareAsync')
var defaultResultBuilderCallback = require('./resultBuilder/defaultResultBuilderCallback')
var defaultFileCompare = require('./fileCompareHandler/defaultFileCompare')
var lineBasedFileCompare = require('./fileCompareHandler/lineBasedFileCompare')
var defaultNameCompare = require('./nameCompare/defaultNameCompare')
var entryBuilder = require('./entry/entryBuilder')
var statsLifecycle = require('./statistics/statisticsLifecycle')
var loopDetector = require('./symlink/loopDetector')

var ROOT_PATH = pathUtils.sep

var compareSync = function (path1, path2, options) {
    'use strict'
    // realpathSync() is necessary for loop detection to work properly
    var absolutePath1 = pathUtils.normalize(pathUtils.resolve(fs.realpathSync(path1)))
    var absolutePath2 = pathUtils.normalize(pathUtils.resolve(fs.realpathSync(path2)))
    var diffSet
    options = prepareOptions(options)
    if (!options.noDiffSet) {
        diffSet = []
    }
    var statistics = statsLifecycle.initStats(options)
    compareSyncInternal(
        entryBuilder.buildEntry(absolutePath1, path1, pathUtils.basename(absolutePath1)),
        entryBuilder.buildEntry(absolutePath2, path2, pathUtils.basename(absolutePath2)),
        0, ROOT_PATH, options, statistics, diffSet, loopDetector.initSymlinkCache())
    statsLifecycle.completeStatistics(statistics, options)
    statistics.diffSet = diffSet

    return statistics
}

var wrapper = {
    realPath: function(path, options) {
        return new Promise(function (resolve, reject) {
            fs.realpath(path, options, function(err, resolvedPath) {
                if(err){
                    reject(err)
                } else {
                    resolve(resolvedPath)
                }
            })
        })
    }
}

var compareAsync = function (path1, path2, options) {
    'use strict'
    var absolutePath1, absolutePath2
    return Promise.resolve()
        .then(function () {
            return Promise.all([wrapper.realPath(path1), wrapper.realPath(path2)])
        })
        .then(function (realPaths) {
            var realPath1 = realPaths[0]
            var realPath2 = realPaths[1]
            // realpath() is necessary for loop detection to work properly
            absolutePath1 = pathUtils.normalize(pathUtils.resolve(realPath1))
            absolutePath2 = pathUtils.normalize(pathUtils.resolve(realPath2))
        })
        .then(function () {
            options = prepareOptions(options)
            var asyncDiffSet
            if (!options.noDiffSet) {
                asyncDiffSet = []
            }
            var statistics = statsLifecycle.initStats(options)
            return compareAsyncInternal(
                entryBuilder.buildEntry(absolutePath1, path1, pathUtils.basename(path1)),
                entryBuilder.buildEntry(absolutePath2, path2, pathUtils.basename(path2)),
                0, ROOT_PATH, options, statistics, asyncDiffSet, loopDetector.initSymlinkCache()).then(
                    function () {
                        statsLifecycle.completeStatistics(statistics, options)
                        if (!options.noDiffSet) {
                            var diffSet = []
                            rebuildAsyncDiffSet(statistics, asyncDiffSet, diffSet)
                            statistics.diffSet = diffSet
                        }
                        return statistics
                    })
        })
}

var prepareOptions = function (options) {
    options = options || {}
    var clone = JSON.parse(JSON.stringify(options))
    clone.resultBuilder = options.resultBuilder
    clone.compareFileSync = options.compareFileSync
    clone.compareFileAsync = options.compareFileAsync
    clone.compareNameHandler = options.compareNameHandler
    if (!clone.resultBuilder) {
        clone.resultBuilder = defaultResultBuilderCallback
    }
    if (!clone.compareFileSync) {
        clone.compareFileSync = defaultFileCompare.compareSync
    }
    if (!clone.compareFileAsync) {
        clone.compareFileAsync = defaultFileCompare.compareAsync
    }
    if(!clone.compareNameHandler) {
        clone.compareNameHandler = defaultNameCompare
    }
    clone.dateTolerance = clone.dateTolerance || 1000
    clone.dateTolerance = Number(clone.dateTolerance)
    if (isNaN(clone.dateTolerance)) {
        throw new Error('Date tolerance is not a number')
    }
    return clone
}


// Async diffsets are kept into recursive structures.
// This method transforms them into one dimensional arrays.
var rebuildAsyncDiffSet = function (statistics, asyncDiffSet, diffSet) {
    asyncDiffSet.forEach(function (rawDiff) {
        if (!Array.isArray(rawDiff)) {
            diffSet.push(rawDiff)
        } else {
            rebuildAsyncDiffSet(statistics, rawDiff, diffSet)
        }
    })
}


/**
 * Options:
 * compareSize: true/false - Compares files by size. Defaults to 'false'.
 * compareDate: true/false - Compares files by date of modification (stat.mtime). Defaults to 'false'.
 * dateTolerance: milliseconds - Two files are considered to have the same date if the difference between their modification dates fits within date tolerance. Defaults to 1000 ms.
 * compareContent: true/false - Compares files by content. Defaults to 'false'.
 * compareSymlink: true/false - Compares entries by symlink. Defaults to 'false'.
 * skipSubdirs: true/false - Skips sub directories. Defaults to 'false'.
 * skipSymlinks: true/false - Skips symbolic links. Defaults to 'false'.
 * ignoreCase: true/false - Ignores case when comparing names. Defaults to 'false'.
 * noDiffSet: true/false - Toggles presence of diffSet in output. If true, only statistics are provided. Use this when comparing large number of files to avoid out of memory situations. Defaults to 'false'.
 * includeFilter: File name filter. Comma separated [minimatch](https://www.npmjs.com/package/minimatch) patterns.
 * excludeFilter: File/directory name exclude filter. Comma separated [minimatch](https://www.npmjs.com/package/minimatch) patterns.
 * resultBuilder: Callback for constructing result.
 * 	function (entry1, entry2, state, level, relativePath, options, statistics, diffSet). Called for each compared entry pair. Updates 'statistics' and 'diffSet'.
 * compareFileSync, compareFileAsync: Callbacks for file comparison. 
 * compareNameHandler: Callback for name comparison
 *
 * Result:
 * same: true if directories are identical
 * distinct: number of distinct entries
 * equal: number of equal entries
 * left: number of entries only in path1
 * right: number of entries only in path2
 * differences: total number of differences (distinct+left+right)
 * total: total number of entries (differences+equal)
 * distinctFiles: number of distinct files
 * equalFiles: number of equal files
 * leftFiles: number of files only in path1
 * rightFiles: number of files only in path2
 * differencesFiles: total number of different files (distinctFiles+leftFiles+rightFiles)
 * totalFiles: total number of files (differencesFiles+equalFiles)
 * distinctDirs: number of distinct directories
 * equalDirs: number of equal directories
 * leftDirs: number of directories only in path1
 * rightDirs: number of directories only in path2
 * differencesDirs: total number of different directories (distinctDirs+leftDirs+rightDirs)
 * totalDirs: total number of directories (differencesDirs+equalDirs)
 * brokenLinks:
 *     leftBrokenLinks: number of broken links only in path1
 *     rightBrokenLinks: number of broken links only in path2
 *     distinctBrokenLinks: number of broken links with same name appearing in both path1 and path2
 *     totalBrokenLinks: total number of broken links (leftBrokenLinks+rightBrokenLinks+distinctBrokenLinks)
 * symlinks: Statistics available if 'compareSymlink' options is used
 *     distinctSymlinks: number of distinct links
 *     equalSymlinks: number of equal links
 *     leftSymlinks: number of links only in path1
 *     rightSymlinks: number of links only in path2
 *     differencesSymlinks: total number of different links (distinctSymlinks+leftSymlinks+rightSymlinks)
 *     totalSymlinks: total number of links (differencesSymlinks+equalSymlinks)
 * diffSet - List of changes (present if Options.noDiffSet is false)
 *     path1: absolute path not including file/directory name,
 *     path2: absolute path not including file/directory name,
 *     relativePath: common path relative to root,
 *     name1: file/directory name
 *     name2: file/directory name
 *     state: one of equal, left, right, distinct,
 *     type1: one of missing, file, directory, broken-link
 *     type2: one of missing, file, directory, broken-link
 *     size1: file size
 *     size2: file size
 *     date1: modification date (stat.mtime)
 *     date2: modification date (stat.mtime)
 *     level: depth
 *     reason: Provides reason when two identically named entries are distinct
 *             Not available if entries are equal
 *             One of "different-size", "different-date", "different-content", "broken-link", "different-symlink"
 */
module.exports = {
    compareSync: compareSync,
    compare: compareAsync,
    fileCompareHandlers: {
        defaultFileCompare: defaultFileCompare,
        lineBasedFileCompare: lineBasedFileCompare
    }
}
