// Copyright 2018 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

const browserify = require('browserify');
const babel = require('gulp-babel');
const babel_preset_env = require('babel-preset-env');
const child_process = require('child_process');
const fs = require('fs');
const generateRtlCss = require('./scripts/generate_rtl_css.js');
const gulp = require('gulp');
const gulpif = require('gulp-if');
const gutil = require('gulp-util');
const polymer_build = require('polymer-build');
const source = require('vinyl-source-stream');
const watchify = require('watchify');

//////////////////
//////////////////
//
// Command-line options.
//
//////////////////
//////////////////

const platform = gutil.env.platform || 'android';
const isRelease = gutil.env.release;
const shouldWatch = !!gutil.env.watch;

//////////////////
//////////////////
//
// Helper functions.
//
//////////////////
//////////////////

function runCommand(command) {
  const child = child_process.exec(command);
  // Though Gulp 4 handles "ChildProcess as task" elegantly, it does not make it easy to pass the
  // command's output through to the console.
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  return child;
}

//////////////////
//////////////////
//
// Web app tasks.
//
//////////////////
//////////////////

const WEBAPP_OUT = 'www';

const BUNDLE_PROPAGATION_TARGETS = [
  'platforms/browser/www/cordova_main.js',
  'platforms/android/www/cordova_main.js',
  'platforms/ios/www/cordova_main.js',
  'platforms/osx/www/cordova_main.js',
];

// Copies Babel polyfill from node_modules, as it needs to be included by cordova_index.html.
function copyBabelPolyfill() {
  const babelPolyfill = 'node_modules/babel-polyfill/dist/polyfill.min.js';
  return runCommand(`cp -v ${babelPolyfill} ${WEBAPP_OUT}/babel-polyfill.min.js`);
}

// Bundles code with the entry point www/app/cordova_main.js -> www/cordova_main.js.
//
// Useful Gulp/Browserify examples:
//   https://github.com/gulpjs/gulp/tree/master/docs/recipes
let firstRun = true;
function browserifyAndBabelify() {
  let browserifyInstance =
      browserify({
            entries: `${WEBAPP_OUT}/app/cordova_main.js`,
            debug: true,
            // This enables caching, which makes it much faster on repeated runs (when watching)
            cache: {},
            packageCache: {}
          })
          .transform('babelify', {
            // Transpile code in node_modules, too.
            global: true,
            presets: ['env']
          });

  if (shouldWatch) {
    browserifyInstance = watch(browserifyInstance);
  }

  browserifyInstance = browserifyInstance.bundle();

  if (shouldWatch) {
    // When using watchify, we need to detect and report errors.  Otherwise there will just be a silent freeze!
    // (For example, if we require() a package that is not installed.)
    browserifyInstance = browserifyInstance.on('error', function (e) {
      if (firstRun) {
        // If there is an error on the first run, the build process will not resume, even if the developer fixes the issue.
        // So on the first run, we should always throw.
        throw e;
      } else {
        // On later runs, we can just report the error, and give the developer a chance to fix the issue.
        // The watcher will try to babelify and bundle again after a source file has been changed.
        console.error('Error while bundling: ', e.stack);
      }
    });
    // If we are not watching, then errors are automatically reported.
  }

  return browserifyInstance
      // Transform the bundle() output stream into one regular Gulp plugins understand.
      .pipe(source('cordova_main.js'))
      .pipe(gulp.dest(WEBAPP_OUT));
}

function watch(browserifyInstance) {
  const log = gutil.log.bind(gutil, 'Browserify:');
  const watchified = watchify(browserifyInstance);
  watchified.on('log', log);
  watchified.on('update', function(deps) {
    gutil.log(`The following dependencies were modified, rebuilding... ${deps}`);
    watchified.bundle()
        .pipe(source('cordova_main.js'))
        .pipe(gulp.dest(WEBAPP_OUT))
        .on('finish',
            () => {
              propagateTheBundle();
              gutil.log('Rebuilt');
              firstRun = false;
            })
        .on('error', console.error);
  });
  return browserifyInstance;
}

// If we rebuild the bundle, then push it into all the existing platforms, so it can be tested
// easily
function propagateTheBundle() {
  const srcFile = `${WEBAPP_OUT}/cordova_main.js`;
  for (const targetFile of BUNDLE_PROPAGATION_TARGETS) {
    if (fs.existsSync(targetFile)) {
      child_process.execSync(`cp "${srcFile}" "${targetFile}"`, {stdio: 'inherit'});
      console.log(`Copied ${srcFile} -> ${targetFile}`);
    }
  }
}

// Transpiles to |src| to ES5, copying the output to |dest|.
function transpile(src, dest) {
  const sourcesHtmlSplitter = new polymer_build.HtmlSplitter();
  return gulp.src(src)
      .pipe(sourcesHtmlSplitter.split())
      .pipe(gulpif(/\.js$/, babel({presets: [babel_preset_env.default()]})))
      .pipe(sourcesHtmlSplitter.rejoin())
      .pipe(gulp.dest(dest));
}

// Note: This is currently done "in-place", i.e. the components are downloaded to `WEBAPP_OUT` and
// transpiled there, but this seems to work just fine (idempodent).
function transpileBowerComponents() {
  // Transpile bower_components with the exception of webcomponentsjs, which contains transpiled
  // polyfills, and minified files, which are generally already transpiled.
  const bowerComponentsSrc = [
    `${WEBAPP_OUT}/bower_components/**/*.html`, `${WEBAPP_OUT}/bower_components/**/*.js`,
    `!${WEBAPP_OUT}/bower_components/webcomponentsjs/**/*.js`,
    `!${WEBAPP_OUT}/bower_components/webcomponentsjs/**/*.html`,
    `!${WEBAPP_OUT}/bower_components/**/*.min.js`
  ];
  const bowerComponentsDest = `${WEBAPP_OUT}/bower_components`;
  return transpile(bowerComponentsSrc, bowerComponentsDest);
}

// Transpiling and generating RTL CSS happens sequentially, which means that the output of the first
// step must be the source of the next; otherwise the last step will clobber the previous steps.
// To avoid this, we transpile and generate RTL CSS in-place, with `WEBAPP_OUT` as input and output.
function transpileUiComponents() {
  return transpile([`${WEBAPP_OUT}/ui_components/*.html`], `${WEBAPP_OUT}/ui_components`);
}

function rtlCss() {
  return generateRtlCss(`${WEBAPP_OUT}/ui_components/*.html`, `${WEBAPP_OUT}/ui_components`)
}

function buildWebApp() {
  return runCommand(`yarn do src/www/build`);
}

const transpileWebApp = gulp.series(
    copyBabelPolyfill, browserifyAndBabelify, transpileBowerComponents, transpileUiComponents,
    rtlCss);

//////////////////
//////////////////
//
// Cordova tasks.
//
//////////////////
//////////////////

// "platform add" is weird: although "cordova build" will succeed without having run it first,
// *certain things won't behave as you'd expect*, notably cordova-custom-config.
function cordovaPlatformAdd() {
  // "platform add" fails if the platform has already been added.
  return runCommand(`test -d platforms/${platform} || cordova platform add ${platform}`);
}

function cordovaPrepare() {
  return runCommand(`cordova prepare ${platform}`);
}

function xcode() {
  return runCommand(
      (platform === 'ios' || platform === 'osx') ?
          `rsync -avc apple/xcode/${platform}/ platforms/${platform}/` :
          'echo not running on apple, skipping xcode rsync');
}

function cordovaCompile() {
  const platformArgs = platform === 'android' ? '--gradleArg=-PcdvBuildMultipleApks=true' : '';
  // Use flag -UseModernBuildSystem=0 as a workaround for Xcode 10 compatibility until upgrading to
  // cordova-ios@5.0.0. See https://github.com/apache/cordova-ios/issues/404.
  const compileArgs = platform === 'ios' ? '--device --buildFlag="-UseModernBuildSystem=0"' : '';
  const releaseArgs = isRelease ? platform === 'android' ?
                                  `--release -- --keystore=${gutil.env.KEYSTORE} ` +
              `--storePassword=${gutil.env.STOREPASS} --alias=${gutil.env.KEYALIAS} ` +
              `--password=${gutil.env.KEYPASS}` :
                                  '--release' :
                                  '';
  return runCommand(`cordova compile ${platform} ${compileArgs} ${releaseArgs} -- ${platformArgs}`);
}

const cordovaBuild = gulp.series(cordovaPrepare, xcode, cordovaCompile);

const packageWithCordova = gulp.series(cordovaPlatformAdd, cordovaBuild);

function maybeRunCordova() {
  if (shouldWatch) {
    gutil.log('Running...');
    return runCommand(`cordova run ${platform} --noprepare --nobuild`);
  } else {
    return Promise.resolve(true);
  }
}

//////////////////
//////////////////
//
// All other and
// exported tasks.
//
//////////////////
//////////////////

// Writes a JSON file accessible to environment.ts containing environment variables.
function writeEnvJson() {
  // bash for Windows' (Cygwin's) benefit (sh can *not* run this script, at least on Alpine).
  return runCommand(`bash scripts/environment_json.sh -p ${platform} ${isRelease ? '-r' : ''} > ${
      WEBAPP_OUT}/environment.json`);
}

exports.build =
    gulp.series(buildWebApp, transpileWebApp, writeEnvJson, packageWithCordova, maybeRunCordova);
