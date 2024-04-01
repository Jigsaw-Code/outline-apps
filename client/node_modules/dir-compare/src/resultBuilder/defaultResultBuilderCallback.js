'use strict'

var pathUtils = require('path')
var common = require('../entry/entryBuilder')
var entryType = require('../entry/entryType')

module.exports = function (entry1, entry2, state, level, relativePath, options, statistics, diffSet, reason) {
    if (options.noDiffSet) {
        return
    }
    diffSet.push({
        path1: entry1 ? pathUtils.dirname(entry1.path) : undefined,
        path2: entry2 ? pathUtils.dirname(entry2.path) : undefined,
        relativePath: relativePath,
        name1: entry1 ? entry1.name : undefined,
        name2: entry2 ? entry2.name : undefined,
        state: state,
        type1: entryType.getType(entry1),
        type2: entryType.getType(entry2),
        level: level,
        size1: entry1 ? entry1.stat.size : undefined,
        size2: entry2 ? entry2.stat.size : undefined,
        date1: entry1 ? entry1.stat.mtime : undefined,
        date2: entry2 ? entry2.stat.mtime : undefined,
        reason: reason
    })
}
