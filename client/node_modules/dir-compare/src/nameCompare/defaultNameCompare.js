
module.exports = function compareName(name1, name2, options) {
	if (options.ignoreCase) {
		name1 = name1.toLowerCase()
		name2 = name2.toLowerCase()
	}
	return strcmp(name1, name2)
}

function strcmp(str1, str2) {
	return ((str1 === str2) ? 0 : ((str1 > str2) ? 1 : -1))
}
