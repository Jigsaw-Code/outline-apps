/**
 * Determines order criteria for sorting entries in a directory.
 */
module.exports = {
	compareEntry: function (a, b, options) {
		if (a.isBrokenLink && b.isBrokenLink) {
			return options.compareNameHandler(a.name, b.name, options)
		} else if (a.isBrokenLink) {
			return -1
		} else if (b.isBrokenLink) {
			return 1
		} else if (a.stat.isDirectory() && b.stat.isFile()) {
			return -1
		} else if (a.stat.isFile() && b.stat.isDirectory()) {
			return 1
		} else {
			return options.compareNameHandler(a.name, b.name, options)
		}
	}
}
