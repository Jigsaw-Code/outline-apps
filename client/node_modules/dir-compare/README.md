dir-compare
==========
Node JS directory compare

[![Build Status](https://api.travis-ci.org/gliviu/dir-compare.svg?branch=master)](https://travis-ci.org/gliviu/dir-compare)
[![Build status](https://ci.appveyor.com/api/projects/status/fpnqkr2gfg7pwkxk/branch/master?svg=true)](https://ci.appveyor.com/project/gliviu/dir-compare)
[![codecov.io](http://codecov.io/github/gliviu/dir-compare/coverage.svg?branch=master)](http://codecov.io/github/gliviu/dir-compare?branch=master)

- [Installation](#installation)
- [Library](#library)
  * [Use](#use)
  * [Api](#api)
  * [Glob patterns](#glob-patterns)
  * [Custom file content comparators](#custom-file-content-comparators)
    + [Ignore line endings and white spaces](#ignore-line-endings-and-white-spaces)
  * [Custom name comparators](#custom-name-comparators)
  * [Custom result builder](#custom-result-builder)
  * [Symbolic links](#symbolic-links)
- [Command line](#command-line)
- [Changelog](#changelog)

# Installation
```shell
$ npm install dir-compare
```
or
```shell
$ npm install -g dir-compare
```
for command line utility.

# Library

## Use
```javascript
const dircompare = require('dir-compare');

const options = { compareSize: true };
// Multiple compare strategy can be used simultaneously - compareSize, compareContent, compareDate, compareSymlink.
// If one comparison fails for a pair of files, they are considered distinct.
const path1 = '...';
const path2 = '...';

// Synchronous
const res = dircompare.compareSync(path1, path2, options)
print(res)

// Asynchronous
dircompare.compare(path1, path2, options)
  .then(res => print(res))
  .catch(error => console.error(error));


function print(result) {
  console.log('Directories are %s', result.same ? 'identical' : 'different')

  console.log('Statistics - equal entries: %s, distinct entries: %s, left only entries: %s, right only entries: %s, differences: %s',
    result.equal, result.distinct, result.left, result.right, result.differences)

  result.diffSet.forEach(dif => console.log('Difference - name1: %s, type1: %s, name2: %s, type2: %s, state: %s',
    dif.name1, dif.type1, dif.name2, dif.type2, dif.state))
}
```

Typescript
```typescript
import { compare, compareSync, Options, Result } from "dir-compare";
const path1 = '...';
const path2 = '...';
const options: Options = { compareSize: true };

const res: Result = compareSync(path1, path2, options);
console.log(res)

compare(path1, path2, options)
  .then(res => console.log(res))
  .catch(error => console.error(error));
```

## Api


Below is a quick recap of the api. For more details check the [reference documentation](https://gliviu.github.io/dc-api/).
```typescript
compare(path1: string, path2: string, options?: Options): Promise<Result>
compareSync(path1: string, path2: string, options?: Options): Result
```

```Options```
* **compareSize**: true/false - Compares files by size. Defaults to 'false'.
* **compareContent**: true/false - Compares files by content. Defaults to 'false'.
* **compareFileSync**, **compareFileAsync**: Callbacks for file comparison. See [Custom file content comparators](#custom-file-content-comparators).
* **compareDate**: true/false - Compares files by date of modification (stat.mtime). Defaults to 'false'.
* **compareNameHandler**: Callback for name comparison. See [Custom name comparators](#custom-name-comparators).
* **dateTolerance**: milliseconds - Two files are considered to have the same date if the difference between their modification dates fits within date tolerance. Defaults to 1000 ms.
* **compareSymlink**: true/false - Compares entries by symlink. Defaults to 'false'.
* **skipSymlinks**: true/false - Ignore symbolic links. Defaults to 'false'.
* **skipSubdirs**: true/false - Skips sub directories. Defaults to 'false'.
* **ignoreCase**: true/false - Ignores case when comparing names. Defaults to 'false'.
* **noDiffSet**: true/false - Toggles presence of diffSet in output. If true, only statistics are provided. Use this when comparing large number of files to avoid out of memory situations. Defaults to 'false'.
* **includeFilter**: File name filter. Comma separated [minimatch](https://www.npmjs.com/package/minimatch) patterns. See [Glob patterns](#glob-patterns) below.
* **excludeFilter**: File/directory name exclude filter. Comma separated [minimatch](https://www.npmjs.com/package/minimatch) patterns.  See [Glob patterns](#glob-patterns) below.
* **resultBuilder**: Callback for constructing result. Called for each compared entry pair. Updates `statistics` and `diffSet`. More details in [Custom result builder](#custom-result-builder).

```Result```
* **same**: true if directories are identical
* **distinct**: number of distinct entries
* **equal**: number of equal entries
* **left**: number of entries only in path1
* **right**: number of entries only in path2
* **differences**: total number of differences (distinct+left+right)
* **total**: total number of entries (differences+equal)
* **distinctFiles**: number of distinct files
* **equalFiles**: number of equal files
* **leftFiles**: number of files only in path1
* **rightFiles**: number of files only in path2
* **differencesFiles**: total number of different files (distinctFiles+leftFiles+rightFiles)
* **totalFiles**: total number of files (differencesFiles+equalFiles)
* **distinctDirs**: number of distinct directories
* **equalDirs**: number of equal directories
* **leftDirs**: number of directories only in path1
* **rightDirs**: number of directories only in path2
* **differencesDirs**: total number of different directories (distinctDirs+leftDirs+rightDirs)
* **totalDirs**: total number of directories (differencesDirs+equalDirs)
* **brokenLinks**:
    * **leftBrokenLinks**: number of broken links only in path1
    * **rightBrokenLinks**: number of broken links only in path2
    * **distinctBrokenLinks**: number of broken links with same name appearing in both path1 and path2
    * **totalBrokenLinks**: total number of broken links (leftBrokenLinks+rightBrokenLinks+distinctBrokenLinks)
* **symlinks**: Statistics available if `compareSymlink` options is used
    * **distinctSymlinks**: number of distinct links
    * **equalSymlinks**: number of equal links
    * **leftSymlinks**: number of links only in path1
    * **rightSymlinks**: number of links only in path2
    * **differencesSymlinks**: total number of different links (distinctSymlinks+leftSymlinks+rightSymlinks)
    * **totalSymlinks**: total number of links (differencesSymlinks+equalSymlinks)
* **diffSet** - List of changes (present if `options.noDiffSet` is false)
    * **path1**: path not including file/directory name; can be relative or absolute depending on call to compare(),
    * **path2**: path not including file/directory name; can be relative or absolute depending on call to compare(),
    * **relativePath**: path relative to root,
    * **name1**: file/directory name
    * **name2**: file/directory name
    * **state**: one of equal, left, right, distinct,
    * **type1**: one of missing, file, directory, broken-link
    * **type2**: one of missing, file, directory, broken-link
    * **size1**: file size
    * **size2**: file size
    * **date1**: modification date (stat.mtime)
    * **date2**: modification date (stat.mtime)
    * **level**: depth
    * **reason**: Provides reason when two identically named entries are distinct.  
      Not available if entries are equal.  
      One of "different-size", "different-date", "different-content", "broken-link", "different-symlink".

##  Glob patterns
[Minimatch](https://www.npmjs.com/package/minimatch) patterns are used to include/exclude files to be compared.

The pattern is matched against the relative path of the entry being compared.

Following examples assume we are comparing two [dir-compare](https://github.com/gliviu/dir-compare) code bases.


```
dircompare -x ".git,node_modules" dir1 dir2')    exclude git and node modules directories
dircompare -x "expected" dir1 dir2')             exclude '/tests/expected' directory
dircompare -x "/tests/expected" dir1 dir2')      exclude '/tests/expected' directory
dircompare -x "**/expected" dir1 dir2')          exclude '/tests/expected' directory
dircompare -x "**/tests/**/*.js" dir1 dir2')     exclude all js files in '/tests' directory and subdirectories
dircompare -f "*.js,*.yml" dir1 dir2')           include js and yaml files
dircompare -f "/tests/**/*.js" dir1 dir2')       include all js files in '/tests' directory and subdirectories
dircompare -f "**/tests/**/*.ts" dir1 dir2')     include all js files in '/tests' directory and subdirectories
```

## Custom file content comparators
By default file content is binary compared. As of version 1.5.0 custom file comparison handlers may be specified.

Custom handlers are specified by `compareFileSync` and `compareFileAsync` options which correspond to `dircompare.compareSync()` or `dircompare.compare()` methods.

A couple of handlers are included in the library:
* binary sync compare - `dircompare.fileCompareHandlers.defaultFileCompare.compareSync`
* binary async compare - `dircompare.fileCompareHandlers.defaultFileCompare.compareAsync`
* text sync compare - `dircompare.fileCompareHandlers.lineBasedFileCompare.compareSync`
* text async compare - `dircompare.fileCompareHandlers.lineBasedFileCompare.compareAsync`

Use [defaultFileCompare.js](https://github.com/gliviu/dir-compare/blob/master/src/fileCompareHandler/defaultFileCompare.js) as an example to create your own.

### Ignore line endings and white spaces
Line based comparator can be used to ignore line ending and white space differences. This comparator is not available in [CLI](#command-line) mode.
```javascript
var dircompare = require('dir-compare');

var options = {
  compareContent: true,
  compareFileSync: dircompare.fileCompareHandlers.lineBasedFileCompare.compareSync,
  compareFileAsync: dircompare.fileCompareHandlers.lineBasedFileCompare.compareAsync,
  ignoreLineEnding: true,
  ignoreWhiteSpaces: true
};

var path1 = '...';
var path2 = '...';
var res = dircompare.compareSync(path1, path2, options);
console.log(res)

dircompare.compare(path1, path2, options)
.then(res => console.log(res))
```
## Custom name comparators
If [default](https://github.com/gliviu/dir-compare/blob/master/src/nameCompare/defaultNameCompare.js) name comparison is not enough, custom behavior can be specified with [compareNameHandler](https://gliviu.github.io/dc-api/index.html#comparenamehandler) option.
Following example adds the possibility to ignore file extensions.
```typescript
import { Options, compare } from 'dir-compare'
import path from 'path'

var options: Options = {
    compareSize: false,                    // compare only name by disabling size and content criteria
    compareContent: false,
    compareNameHandler: customNameCompare, // new name comparator used to ignore extensions
    ignoreExtension: true,                 // supported by the custom name compare below
};

function customNameCompare(name1: string, name2: string, options: Options) {
    if (options.ignoreCase) {
        name1 = name1.toLowerCase()
        name2 = name2.toLowerCase()
    }
    if (options.ignoreExtension) {
        name1 = path.basename(name1, path.extname(name1))
        name2 = path.basename(name2, path.extname(name2))
    }
    return ((name1 === name2) ? 0 : ((name1 > name2) ? 1 : -1))
}

var path1 = '/tmp/a';
var path2 = '/tmp/b';

var res = compare(path1, path2, options).then(res => {
    console.log(`Same: ${res.same}`)
    if (!res.diffSet) {
        return
    }
    res.diffSet.forEach(dif => console.log(`${dif.name1} ${dif.name2} ${dif.state}`))
})

// Outputs
// icon.svg icon.png equal
// logo.svg logo.jpg equal
```

## Custom result builder
[Result builder](https://gliviu.github.io/dc-api/index.html#resultbuilder) is called for each pair of entries encountered during comparison. Its purpose is to append entries in `diffSet` and eventually update `statistics` object with new stats.

If needed it can be replaced with custom implementation.

```javascript
var dircompare = require("dircompare")

var customResultBuilder = function (entry1, entry2, state, level, relativePath, options, statistics, diffSet, reason) {
    ...
}

var options = {
    compareSize: true,
    resultBuilder: customResultBuilder
}
var res = dircompare.compareSync('...', '...', options)

```

The [default](https://github.com/gliviu/dir-compare/blob/master/src/resultBuilder/defaultResultBuilderCallback.js) builder can be used as an example.

## Symbolic links
Unless `compareSymlink` option is used, symbolic links are resolved and any comparison is applied to the file/directory they point to.

Circular loops are handled by breaking the loop as soon as it is detected.

Version `1.x` treats broken links as `ENOENT: no such file or directory`.  
Since `2.0` they are treated as a special type of entry - `broken-link` - and are available as stats (`totalBrokenLinks`, `distinctBrokenLinks`, ...).

Using `compareSymlink` option causes `dircompare` to check symlink values for equality.
In this mode two entries with identical name are considered different if
* one is symlink, the other is not
* both are symlinks but point to different locations

These rules are applied in addition to the other comparison modes; ie. by content, by size...

If entries are different because of symlinks, `reason` will be `different-symlink`. Also statistics summarizes differences caused by symbolik links.

# Command line
```
  Usage: dircompare [options] leftdir rightdir

  Options:

    -h, --help               output usage information
    -V, --version            output the version number
    -c, --compare-content    compare files by content
    -D, --compare-date       compare files by date
    --date-tolerance [type]  tolerance to be used in date comparison (milliseconds)
    --compare-symlink        compare files and directories by symlink
    -f, --filter [type]      file name filter
    -x, --exclude [type]     file/directory name exclude filter
    -S, --skip-subdirs       do not recurse into subdirectories
    -L, --skip-symlinks      ignore symlinks
    -i, --ignore-case        ignores case when comparing file names
    -l, --show-left          report - show entries occurring in left dir
    -r, --show-right         report - show entries occurring in right dir
    -e, --show-equal         report - show identic entries occurring in both dirs
    -d, --show-distinct      report - show distinct entries occurring in both dirs
    -a, --show-all           report - show all entries
    -w, --whole-report       report - include directories in detailed report
    --reason                 report - show reason when entries are distinct
    --csv                    report - print details as csv
    --nocolors               don't use console colors
    --async                  Make use of multiple cores

  By default files are compared by size.
  --date-tolerance defaults to 1000 ms. Two files are considered to have
  the same date if the difference between their modification dates fits
  within date tolerance.

  Exit codes:
    0 - entries are identical
    1 - entries are different
    2 - error occurred

  Examples:
  compare by content         dircompare -c dir1 dir2
  show only different files  dircompare -d dir1 dir2

  exclude filter             dircompare -x ".git,node_modules" dir1 dir2
                             dircompare -x "/tests/expected" dir1 dir2
                             dircompare -x "**/expected" dir1 dir2
                             dircompare -x "**/tests/**/*.ts" dir1 dir2
  
  include filter             dircompare -f "*.js,*.yml" dir1 dir2
                             dircompare -f "/tests/**/*.js" dir1 dir2
                             dircompare -f "**/tests/**/*.ts" dir1 dir2
```

# Changelog
* v2.4.0 New option to customize file/folder name comparison
* v2.3.0 Fixes
* v2.1.0 Removed [bluebird](https://github.com/petkaantonov/bluebird/#note) dependency
* v2.0.0
  * New option to compare symlinks.
  * New field indicating reason for two entries being distinct.
  * Improved command line output format.
  * Tests are no longer part of published package.
  * Generated [Api](#api) documentation.
  
  Breaking changes:
  * Broken links are no longer treated as errors. As a result there are new statistics (leftBrokenLinks, rightBrokenLinks, distinctBrokenLinks, totalBrokenLinks) and new entry type - broken-link.
    Details in [Symbolic links](#symbolic-links).
  * Typescript correction: new interface `Result` replaced `Statistics`.
* v1.8.0 
    * globstar patterns
    * typescript corrections
    * removed support for node 0.11, 0.12, iojs
* v1.7.0 performance improvements
* v1.6.0 typescript support
* v1.5.0 added option to ignore line endings and white space differences
* v1.3.0 added date tolerance option
* v1.2.0 added compare by date option
* v1.1.0
    * detect symlink loops
    * improved color scheme for command line utility
* v1.0.0
    * asynchronous processing
    * new library options: noDiffSet, resultBuilder
    * new statistics: distinctFiles, equalFiles, leftFiles, rightFiles, distinctDirs, equalDirs, leftDirs, rightDirs
    * new --async command line option
    * Fix for https://github.com/tj/commander.js/issues/125
* v0.0.3 Fix fille ordering issue for newer node versions
