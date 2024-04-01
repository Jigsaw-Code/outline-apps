/// <reference types="node" />

import * as fs from "fs"

/**
 * Synchronously compares given paths.
 * @param path1 Left file or directory to be compared.
 * @param path2 Right file or directory to be compared.
 * @param options Comparison options.
 */
export function compareSync(path1: string, path2: string, options?: Options): Result

/**
 * Asynchronously compares given paths.
 * @param path1 Left file or directory to be compared.
 * @param path2 Right file or directory to be compared.
 * @param options Comparison options.
 */
export function compare(path1: string, path2: string, options?: Options): Promise<Result>

/**
 * Comparison options.
 */
export interface Options {
    /**
     * Properties to be used in various extension points ie. result builder.
     */
    [key: string]: any

    /**
     * Compares files by size. Defaults to 'false'.
     */
    compareSize?: boolean

    /**
     *  Compares files by date of modification (stat.mtime). Defaults to 'false'.
     */
    compareDate?: boolean

    /**
     * Two files are considered to have the same date if the difference between their modification dates fits within date tolerance. Defaults to 1000 ms.
     */
    dateTolerance?: number

    /**
     * Compares files by content. Defaults to 'false'.
     */
    compareContent?: boolean

    /**
     * Compares entries by symlink. Defaults to 'false'.
     */
    compareSymlink?: boolean

    /**
     * Skips sub directories. Defaults to 'false'.
     */
    skipSubdirs?: boolean

    /**
     * Ignore symbolic links. Defaults to 'false'.
     */
    skipSymlinks?: boolean

    /**
     * Ignores case when comparing names. Defaults to 'false'.
     */
    ignoreCase?: boolean

    /**
     * Toggles presence of diffSet in output. If true, only statistics are provided. Use this when comparing large number of files to avoid out of memory situations. Defaults to 'false'.
     */
    noDiffSet?: boolean

    /**
     * File name filter. Comma separated minimatch patterns. See [Glob patterns](https://github.com/gliviu/dir-compare#glob-patterns).
     */
    includeFilter?: string

    /**
     * File/directory name exclude filter. Comma separated minimatch patterns. See [Glob patterns](https://github.com/gliviu/dir-compare#glob-patterns)
     */
    excludeFilter?: string

    /**
     * Callback for constructing result. Called for each compared entry pair.
     * 
     * Updates 'statistics' and 'diffSet'.
     * 
     * See [Custom result builder](https://github.com/gliviu/dir-compare#custom-result-builder).
     */
    resultBuilder?: ResultBuilder

    /**
     * File comparison handler. See [Custom file comparators](https://github.com/gliviu/dir-compare#custom-file-content-comparators).
     */
    compareFileSync?: CompareFileSync

    /**
     * File comparison handler. See [Custom file comparators](https://github.com/gliviu/dir-compare#custom-file-content-comparators).
     */
    compareFileAsync?: CompareFileAsync

    /**
     * Entry name comparison handler. See [Custom name comparators](https://github.com/gliviu/dir-compare#custom-name-comparators).
     */
    compareNameHandler?: CompareNameHandler
}

/**
 * Callback for constructing result. Called for each compared entry pair.
 * 
 * Updates 'statistics' and 'diffSet'.
 */
export type ResultBuilder =
    /**
     * @param entry1 Left entry.
     * @param entry2 Right entry.
     * @param state See [[DifferenceState]].
     * @param level Depth level relative to root dir.
     * @param relativePath Path relative to root dir.
     * @param statistics Statistics to be updated.
     * @param diffSet Status per each entry to be appended.
     * Do not append if [[Options.noDiffSet]] is false.
     * @param reason See [[Reason]]. Not available if entries are equal.
     */
    (
        entry1: Entry | undefined,
        entry2: Entry | undefined,
        state: DifferenceState,
        level: number,
        relativePath: string,
        options: Options,
        statistics: Statistics,
        diffSet: Array<Difference> | undefined,
        reason: Reason | undefined
    ) => void

export interface Entry {
    name: string
    absolutePath: string
    path: string
    stat: fs.Stats
    lstat: fs.Stats
    symlink: boolean
}

/**
 * Comparison result.
 */
export interface Result extends Statistics {
    /**
     * List of changes (present if [[Options.noDiffSet]] is false).
     */
    diffSet?: Array<Difference>
}

export interface Statistics {
    /**
     * Any property is allowed if default result builder is not used.
     */
    [key: string]: any

    /**
     * True if directories are identical.
     */
    same: boolean

    /**
     * Number of distinct entries.
     */
    distinct: number

    /**
     * Number of equal entries.
     */
    equal: number

    /**
     * Number of entries only in path1.
     */
    left: number

    /**
     * Number of entries only in path2.
     */
    right: number

    /**
     * Total number of differences (distinct+left+right).
     */
    differences: number

    /**
     * Total number of entries (differences+equal).
     */
    total: number

    /**
     * Number of distinct files.
     */
    distinctFiles: number

    /**
     * Number of equal files.
     */
    equalFiles: number

    /**
     * Number of files only in path1.
     */
    leftFiles: number

    /**
     * Number of files only in path2
     */
    rightFiles: number

    /**
     * Total number of different files (distinctFiles+leftFiles+rightFiles).
     */
    differencesFiles: number

    /**
     * Total number of files (differencesFiles+equalFiles).
     */
    totalFiles: number

    /**
     * Number of distinct directories.
     */
    distinctDirs: number

    /**
     * Number of equal directories.
     */
    equalDirs: number

    /**
     * Number of directories only in path1.
     */
    leftDirs: number

    /**
     * Number of directories only in path2.
     */
    rightDirs: number

    /**
     * Total number of different directories (distinctDirs+leftDirs+rightDirs).
     */
    differencesDirs: number

    /**
     * Total number of directories (differencesDirs+equalDirs).
     */
    totalDirs: number

    /**
     * Stats about broken links.
     */
    brokenLinks: BrokenLinksStatistics

    /**
     * Statistics available if 'compareSymlink' options is used.
     */
    symlinks?: SymlinkStatistics
}

export interface BrokenLinksStatistics {
    /**
     * Number of broken links only in path1
     */
    leftBrokenLinks: number

    /**
     * Number of broken links only in path2
     */
    rightBrokenLinks: number

    /**
     * Number of broken links with same name appearing in both path1 and path2  (leftBrokenLinks+rightBrokenLinks+distinctBrokenLinks)
     */
    distinctBrokenLinks: number

    /**
     * Total number of broken links
     */
    totalBrokenLinks: number

}

export interface SymlinkStatistics {
    /**
     * Number of distinct links.
     */
    distinctSymlinks: number

    /**
     * Number of equal links.
     */
    equalSymlinks: number

    /**
     * Number of links only in path1.
     */
    leftSymlinks: number

    /**
     * Number of links only in path2
     */
    rightSymlinks: number

    /**
     * Total number of different links (distinctSymlinks+leftSymlinks+rightSymlinks).
     */
    differencesSymlinks: number

    /**
     * Total number of links (differencesSymlinks+equalSymlinks).
     */
    totalSymlinks: number

}

/**
 * State of left/right entries relative to each other.
 */
export type DifferenceState = "equal" | "left" | "right" | "distinct"

/**
 * Type of entry.
 */
export type DifferenceType = "missing" | "file" | "directory" | "broken-link"

/**
 * Provides reason when two identically named entries are distinct.
 */
export type Reason = "different-size" | "different-date" | "different-content" | "broken-link" | 'different-symlink'

export interface Difference {
    /**
     * Any property is allowed if default result builder is not used.
     */
    [key: string]: any

    /**
     * Path not including file/directory name; can be relative or absolute depending on call to compare().
     */
    path1?: string

    /**
     * Path not including file/directory name; can be relative or absolute depending on call to compare().
     */
    path2?: string

    /**
     * Path relative to root dir.
     */
    relativePath: string

    /**
     * Left file/directory name.
     */
    name1?: string

    /**
     * Right file/directory name.
     */
    name2?: string

    /**
     * See [[DifferenceState]]
     */
    state: DifferenceState

    /**
     * Type of left entry.
     */
    type1: DifferenceType

    /**
     * Type of right entry.
     */
    type2: DifferenceType

    /**
     * Left file size.
     */
    size1?: number

    /**
     * Right file size.
     */
    size2?: number

    /**
     * Left entry modification date (stat.mtime).
     */
    date1?: number

    /**
     * Right entry modification date (stat.mtime).
     */
    date2?: number

    /**
     * Depth level relative to root dir.
     */
    level: number

    /**
     * See [[Reason]].
     * Not available if entries are equal.
     */
    reason?: Reason
}

/**
 * Synchronous file content comparison handler.
 */
export type CompareFileSync = (
    path1: string,
    stat1: fs.Stats,
    path2: string,
    stat2: fs.Stats,
    options: Options
) => boolean

/**
 * Asynchronous file content comparison handler.
 */
export type CompareFileAsync = (
    path1: string,
    stat1: fs.Stats,
    path2: string,
    stat2: fs.Stats,
    options: Options
) => Promise<boolean>

export interface CompareFileHandler {
    compareSync: CompareFileSync,
    compareAsync: CompareFileAsync
}

/**
 * Available file content comparison handlers.
 * These handlers are used when [[Options.compareContent]] is set.
 */
export const fileCompareHandlers: {
    /**
     * Default file content comparison handlers, used if [[Options.compareFileAsync]] or [[Options.compareFileSync]] are not specified.
     * 
     * Performs binary comparison.
     */
    defaultFileCompare: CompareFileHandler,
    /**
     * Compares files line by line.
     * 
     * Options:
     * * ignoreLineEnding - tru/false (default: false)
     * * ignoreWhiteSpaces - tru/false (default: false)
     */
    lineBasedFileCompare: CompareFileHandler
}

/**
 * Compares the names of two entries.
 * The comparison should be dependent on received options (ie. case sensitive, ...).
 * Returns 0 if names are identical, -1 if name1<name2, 1 if name1>name2.
 */
export type CompareNameHandler = (
    name1: string,
    name2: string,
    options: Options
) => 0 | 1 | -1
