var fs = require('fs')
var minimatch = require('minimatch')
var pathUtils = require('path')
var entryComparator = require('./entryComparator')

var PATH_SEP = pathUtils.sep

module.exports = {
	/**
	 * Returns the sorted list of entries in a directory.
	 */
	buildDirEntries: function (rootEntry, dirEntries, relativePath, options) {
		var res = []
		for (var i = 0; i < dirEntries.length; i++) {
			var entryName = dirEntries[i]
			var entryAbsolutePath = rootEntry.absolutePath + PATH_SEP + entryName
			var entryPath = rootEntry.path + PATH_SEP + entryName

			var entry = this.buildEntry(entryAbsolutePath, entryPath, entryName)
			if (options.skipSymlinks && entry.isSymlink) {
				entry.stat = undefined
			}

			if (filterEntry(entry, relativePath, options)) {
				res.push(entry)
			}
		}
		return res.sort((a, b) => entryComparator.compareEntry(a, b, options))
	},

	buildEntry: function (absolutePath, path, name) {
		var stats = getStatIgnoreBrokenLink(absolutePath)

		return {
			name: name,
			absolutePath: absolutePath,
			path: path,
			stat: stats.stat,
			lstat: stats.lstat,
			isSymlink: stats.lstat.isSymbolicLink(),
			isBrokenLink: stats.isBrokenLink,
			isDirectory: stats.stat.isDirectory()
		}
	},

}


function getStatIgnoreBrokenLink(absolutePath) {
	var lstat = fs.lstatSync(absolutePath)
	try {
		return {
			stat: fs.statSync(absolutePath),
			lstat: lstat,
			isBrokenLink: false
		}
	} catch (error) {
		if (error.code === 'ENOENT') {
			return {
				stat: lstat,
				lstat: lstat,
				isBrokenLink: true
			}
		}
		throw error
	}
}

/**
 * Filter entries by file name. Returns true if the file is to be processed.
 */
function filterEntry(entry, relativePath, options) {
	if (entry.isSymlink && options.skipSymlinks) {
		return false
	}
	var path = pathUtils.join(relativePath, entry.name)

	if ((entry.stat.isFile() && options.includeFilter) && (!match(path, options.includeFilter))) {
		return false
	}

	if ((options.excludeFilter) && (match(path, options.excludeFilter))) {
		return false
	}

	return true
}

/**
 * Matches path by pattern.
 */
function match(path, pattern) {
	var patternArray = pattern.split(',')
	for (var i = 0; i < patternArray.length; i++) {
		var pat = patternArray[i]
		if (minimatch(path, pat, { dot: true, matchBase: true })) { //nocase
			return true
		}
	}
	return false
}

