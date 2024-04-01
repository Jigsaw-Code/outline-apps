
module.exports = {
	/**
	 * One of 'missing','file','directory','broken-link'
	 */
	getType: function (entry) {
		if (!entry) {
			return 'missing'
		}
		if (entry.isBrokenLink) {
			return 'broken-link'
		}
		if (entry.isDirectory) {
			return 'directory'
		}
		return 'file'
	}
}