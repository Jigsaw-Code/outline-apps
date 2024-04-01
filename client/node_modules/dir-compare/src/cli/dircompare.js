#!/usr/bin/env node

var program = require('commander')
var dircompare = require('../index')
var fs = require('fs')
var util = require('util')
var print = require('./print')
var pjson = require('../../package.json')

program
    .version(pjson.version)
    .usage('[options] leftdir rightdir')
    .option('-c, --compare-content', 'compare files by content')
    .option('-D, --compare-date', 'compare files by date')
    .option('--date-tolerance [type]', 'tolerance to be used in date comparison (milliseconds)')
    .option('--compare-symlink', 'compare files and directories by symlink')
    .option('-f, --filter [type]', 'file name filter', undefined)
    .option('-x, --exclude [type]', 'file/directory name exclude filter', undefined)
    .option('-S, --skip-subdirs', 'do not recurse into subdirectories')
    .option('-L, --skip-symlinks', 'ignore symlinks')
    .option('-i, --ignore-case', 'ignores case when comparing file names')
    .option('-l, --show-left', 'report - show entries occurring in left dir')
    .option('-r, --show-right', 'report - show entries occurring in right dir')
    .option('-e, --show-equal', 'report - show identic entries occurring in both dirs')
    .option('-d, --show-distinct', 'report - show distinct entries occurring in both dirs')
    .option('-a, --show-all', 'report - show all entries')
    .option('-w, --whole-report', 'report - include directories in detailed report')
    .option('--reason', 'report - show reason when entries are distinct')
    .option('--csv', 'report - print details as csv')
    .option('--nocolors', 'don\'t use console colors')
    .option('--async', 'Make use of multiple cores')


program.on('--help', function () {
    console.log('  By default files are compared by size.')
    console.log('  --date-tolerance defaults to 1000 ms. Two files are considered to have')
    console.log('  the same date if the difference between their modification dates fits')
    console.log('  within date tolerance.')
    console.log()
    console.log('  Exit codes:')
    console.log('    0 - entries are identical')
    console.log('    1 - entries are different')
    console.log('    2 - error occurred')
    console.log()
    console.log('  Examples:')
    console.log('  compare by content         dircompare -c dir1 dir2')
    console.log('  show only different files  dircompare -d dir1 dir2')
    console.log()
    console.log('  exclude filter             dircompare -x ".git,node_modules" dir1 dir2')
    console.log('                             dircompare -x "/tests/expected" dir1 dir2')
    console.log('                             dircompare -x "**/expected" dir1 dir2')
    console.log('                             dircompare -x "**/tests/**/*.ts" dir1 dir2')
    console.log()
    console.log('  include filter             dircompare -f "*.js,*.yml" dir1 dir2')
    console.log('                             dircompare -f "/tests/**/*.js" dir1 dir2')
    console.log('                             dircompare -f "**/tests/**/*.ts" dir1 dir2')
})

// Fix for https://github.com/tj/commander.js/issues/125
program.allowUnknownOption()
program.parse(process.argv)
var parsed = program.parseOptions(program.normalize(process.argv.slice(2)))
if (parsed.unknown.length > 0) {
    console.error('Unknown options: ' + parsed.unknown)
    process.exit(2)
}

var run = function () {
    try {
        if (program.args.length !== 2) {
            program.outputHelp()
            process.exit(2)
        } else {
            var options = {}


            options.compareContent = program.compareContent
            options.compareDate = program.compareDate
            options.compareSymlink = program.compareSymlink
            options.compareSize = true
            options.skipSubdirs = program.skipSubdirs
            options.skipSymlinks = program.skipSymlinks
            options.ignoreCase = program.ignoreCase
            options.includeFilter = program.filter
            options.excludeFilter = program.exclude
            options.noDiffSet = !(program.showAll || program.showEqual || program.showLeft || program.showRight || program.showDistinct)
            options.dateTolerance = program.dateTolerance || 1000

            var async = program.async

            var path1 = program.args[0]
            var path2 = program.args[1]
            var abort = false
            if (!isNumeric(options.dateTolerance)) {
                console.error("Numeric value expected for --date-tolerance")
                abort = true
            }
            if (!fs.existsSync(path1)) {
                console.error(util.format("Path '%s' missing"), path1)
                abort = true
            }
            if (!fs.existsSync(path2)) {
                console.error(util.format("Path '%s' missing"), path2)
                abort = true
            }
            if (!abort) {
                // compare
                var comparePromise
                if (async) {
                    comparePromise = dircompare.compare(path1, path2, options)
                } else {
                    comparePromise = new Promise(function (resolve, reject) {
                        resolve(dircompare.compareSync(path1, path2, options))
                    })
                }

                comparePromise.then(
                    function (res) {
                        // PRINT DETAILS
                        print(res, process.stdout, program)
                        if (res.same) {
                            process.exit(0)
                        } else {
                            process.exit(1)
                        }
                    },
                    function (error) {
                        console.error('Error occurred: ' + (error instanceof Error ? error.stack : error))
                        process.exit(2)
                    })
            } else {
                process.exit(2)
            }
        }
    } catch (e) {
        console.error(e.stack)
        process.exit(2)
    }
}

function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n)
}



run()
