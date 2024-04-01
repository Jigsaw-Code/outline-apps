var fs = require('fs')

/**
 * Provides symlink loop detection to directory traversal algorithm.
 */
module.exports = {
	detectLoop: function (entry, symlinkCache) {
		if (entry && entry.isSymlink) {
			var realPath = fs.realpathSync(entry.absolutePath)
			if (symlinkCache[realPath]) {
				return true
			}
		}
		return false
	},

	initSymlinkCache: function() {
		return {
			dir1: {},
			dir2: {}
		}
	},

	updateSymlinkCache: function(symlinkCache, rootEntry1, rootEntry2, loopDetected1, loopDetected2) {
		var symlinkCachePath1, symlinkCachePath2
		if (rootEntry1 && !loopDetected1) {
			symlinkCachePath1 = rootEntry1.isSymlink ? fs.realpathSync(rootEntry1.absolutePath) : rootEntry1.absolutePath
			symlinkCache.dir1[symlinkCachePath1] = true
		}
		if (rootEntry2 && !loopDetected2) {
			symlinkCachePath2 = rootEntry2.isSymlink ? fs.realpathSync(rootEntry2.absolutePath) : rootEntry2.absolutePath
			symlinkCache.dir2[symlinkCachePath2] = true
		}
	},

	cloneSymlinkCache: function (symlinkCache) {
		return {
			dir1: shallowClone(symlinkCache.dir1),
			dir2: shallowClone(symlinkCache.dir2)
		}
	},
}

function shallowClone(obj) {
	var cloned = {}
	Object.keys(obj).forEach(function (key) {
		cloned[key] = obj[key]
	})
	return cloned
}

