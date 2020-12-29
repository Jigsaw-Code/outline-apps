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
const generateRtlCss = require('./scripts/generate_rtl_css.js');
const gulp = require('gulp');
const gulpif = require('gulp-if');
const log = require('fancy-log');
const minimist = require('minimist');
const os = require('os');
const source = require('vinyl-source-stream');

//////////////////
//////////////////
//
// Command-line options.
//
//////////////////
//////////////////
const args = minimist(process.argv, {boolean: true});
const platform = args.platform || 'android';
const isRelease = args.release;

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

// Copies Babel polyfill from node_modules, as it needs to be included by cordova_index.html.
function copyBabelPolyfill() {
  const babelPolyfill = 'node_modules/babel-polyfill/dist/polyfill.min.js';
  return runCommand(`cp -v ${babelPolyfill} ${WEBAPP_OUT}/babel-polyfill.min.js`);
}

// Bundles code with the entry point www/app/cordova_main.js -> www/cordova_main.js.
//
// Useful Gulp/Browserify examples:
//   https://github.com/gulpjs/gulp/tree/master/docs/recipes
function browserifyAndBabelify() {
  return browserify({entries: `${WEBAPP_OUT}/app/cordova_main.js`, debug: true})
      .transform('babelify', {
        // Transpile code in node_modules, too.
        global: true,
        presets: ['env']
      })
      .bundle()
      // Transform the bundle() output stream into one regular Gulp plugins understand.
      .pipe(source('cordova_main.js'))
      .pipe(gulp.dest(WEBAPP_OUT));
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

function rtlCss() {
  return generateRtlCss(`${WEBAPP_OUT}/ui_components/*.js`, `${WEBAPP_OUT}/ui_components`)
}

function buildWebApp() {
  return runCommand(`yarn do src/www/build`);
}

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
  let releaseArgs = '';
  if (isRelease) {
    releaseArgs = '--release';
    if (platform === 'android') {
      releaseArgs += ` -- --keystore=${args.KEYSTORE} --storePassword=${args.STOREPASS} --alias=${
          args.KEYALIAS} --password=${args.KEYPASS}`;
    }
  }
  return runCommand(`cordova compile ${platform} ${compileArgs} ${releaseArgs} -- ${platformArgs}`);
}

//////////////////
//////////////////
//
// All other and
// exported tasks.
//
//////////////////
//////////////////

function validateBuildEnvironment(cb) {
  if (os.platform() !== 'darwin' && (platform === 'ios' || platform === 'macos')) {
    log.error(
        '\x1b[31m%s\x1b[0m',  // Red text
        'Building the ios client requires xcodebuild and can only be done on MacOS');
    process.exit(1);
  }
  cb();
}

// Writes a JSON file accessible to environment.ts containing environment variables.
function writeEnvJson() {
  // bash for Windows' (Cygwin's) benefit (sh can *not* run this script, at least on Alpine).
  return runCommand(`bash scripts/environment_json.sh -p ${platform} ${isRelease ? '-r' : ''} > ${
      WEBAPP_OUT}/environment.json`);
}

const transpileWebApp = gulp.series(copyBabelPolyfill, browserifyAndBabelify, rtlCss);
const setupWebApp = gulp.series(buildWebApp, transpileWebApp, writeEnvJson);
const setupCordova = gulp.series(cordovaPlatformAdd, cordovaPrepare, xcode);

exports.build = gulp.series(validateBuildEnvironment, setupWebApp, setupCordova, cordovaCompile);
exports.setup = gulp.series(validateBuildEnvironment, setupWebApp, setupCordova);
