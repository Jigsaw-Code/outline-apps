var fs = require('fs')
var entryBuilder = require('./entry/entryBuilder')
var entryEquality = require('./entry/entryEquality')
var stats = require('./statistics/statisticsUpdate')
var pathUtils = require('path')
var fsPromise = require('./fs/fsPromise')
var loopDetector = require('./symlink/loopDetector')
var entryComparator = require('./entry/entryComparator')
var entryType = require('./entry/entryType')

/**
 * Returns the sorted list of entries in a directory.
 */
var getEntries = function (rootEntry, relativePath, loopDetected, options) {
    if (!rootEntry || loopDetected) {
        return Promise.resolve([])
    }
    if (rootEntry.isDirectory) {
        return fsPromise.readdir(rootEntry.absolutePath)
            .then(function (entries) {
                return entryBuilder.buildDirEntries(rootEntry, entries, relativePath, options)
            })
    }
    return Promise.resolve([rootEntry])
}

/**
 * Compares two directories asynchronously.
 */
var compare = function (rootEntry1, rootEntry2, level, relativePath, options, statistics, diffSet, symlinkCache) {
    var loopDetected1 = loopDetector.detectLoop(rootEntry1, symlinkCache.dir1)
    var loopDetected2 = loopDetector.detectLoop(rootEntry2, symlinkCache.dir2)
    loopDetector.updateSymlinkCache(symlinkCache, rootEntry1, rootEntry2, loopDetected1, loopDetected2)

    return Promise.all([getEntries(rootEntry1, relativePath, loopDetected1, options), getEntries(rootEntry2, relativePath, loopDetected2, options)]).then(
        function (entriesResult) {
            var entries1 = entriesResult[0]
            var entries2 = entriesResult[1]
            var i1 = 0, i2 = 0
            var comparePromises = []
            var compareFilePromises = []
            var subDiffSet

            while (i1 < entries1.length || i2 < entries2.length) {
                var entry1 = entries1[i1]
                var entry2 = entries2[i2]
                var type1, type2

                // compare entry name (-1, 0, 1)
                var cmp
                if (i1 < entries1.length && i2 < entries2.length) {
                    cmp = entryComparator.compareEntry(entry1, entry2, options)
                    type1 = entryType.getType(entry1)
                    type2 = entryType.getType(entry2)
                } else if (i1 < entries1.length) {
                    type1 = entryType.getType(entry1)
                    type2 = entryType.getType(undefined)
                    cmp = -1
                } else {
                    type1 = entryType.getType(undefined)
                    type2 = entryType.getType(entry2)
                    cmp = 1
                }

                // process entry
                if (cmp === 0) {
                    // Both left/right exist and have the same name and type
                    var compareAsyncRes = entryEquality.isEntryEqualAsync(entry1, entry2, type1, diffSet, options)
                    var samePromise = compareAsyncRes.samePromise
                    var same = compareAsyncRes.same
                    if (same !== undefined) {
                        options.resultBuilder(entry1, entry2,
                            same ? 'equal' : 'distinct',
                            level, relativePath, options, statistics, diffSet,
                            compareAsyncRes.reason)
                        stats.updateStatisticsBoth(entry1, entry2, compareAsyncRes.same, compareAsyncRes.reason, type1, statistics, options)
                    } else {
                        compareFilePromises.push(samePromise)
                    }

                    i1++
                    i2++
                    if (!options.skipSubdirs && type1 === 'directory') {
                        if (!options.noDiffSet) {
                            subDiffSet = []
                            diffSet.push(subDiffSet)
                        }
                        comparePromises.push(compare(entry1, entry2, level + 1,
                            pathUtils.join(relativePath, entry1.name),
                            options, statistics, subDiffSet, loopDetector.cloneSymlinkCache(symlinkCache)))
                    }
                } else if (cmp < 0) {
                    // Right missing
                    options.resultBuilder(entry1, undefined, 'left', level, relativePath, options, statistics, diffSet)
                    stats.updateStatisticsLeft(entry1, type1, statistics, options)
                    i1++
                    if (type1 === 'directory' && !options.skipSubdirs) {
                        if (!options.noDiffSet) {
                            subDiffSet = []
                            diffSet.push(subDiffSet)
                        }
                        comparePromises.push(compare(entry1, undefined,
                            level + 1,
                            pathUtils.join(relativePath, entry1.name), options, statistics, subDiffSet, loopDetector.cloneSymlinkCache(symlinkCache)))
                    }
                } else {
                    // Left missing
                    options.resultBuilder(undefined, entry2, 'right', level, relativePath, options, statistics, diffSet)
                    stats.updateStatisticsRight(entry2, type2, statistics, options)
                    i2++
                    if (type2 === 'directory' && !options.skipSubdirs) {
                        if (!options.noDiffSet) {
                            subDiffSet = []
                            diffSet.push(subDiffSet)
                        }
                        comparePromises.push(compare(undefined, entry2,
                            level + 1,
                            pathUtils.join(relativePath, entry2.name), options, statistics, subDiffSet, loopDetector.cloneSymlinkCache(symlinkCache)))
                    }
                }
            }
            return Promise.all(comparePromises).then(function () {
                return Promise.all(compareFilePromises).then(function (sameResults) {
                    for (var i = 0; i < sameResults.length; i++) {
                        var sameResult = sameResults[i]
                        if (sameResult.error) {
                            return Promise.reject(sameResult.error)
                        } else {
                            options.resultBuilder(sameResult.entry1, sameResult.entry2,
                                sameResult.same ? 'equal' : 'distinct',
                                level, relativePath, options, statistics, sameResult.diffSet,
                                sameResult.reason)
                            stats.updateStatisticsBoth(sameResult.entries1, sameResult.entries2, sameResult.same, sameResult.reason, sameResult.type1, statistics, options)
                        }
                    }
                })
            })
        })
}

module.exports = compare
