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
const gutil = require('gulp-util');
const polymer_build = require('polymer-build');
const source = require('vinyl-source-stream');

//////////////////
//////////////////
//
// Command-line options.
//
//////////////////
//////////////////

const platform = gutil.env.platform || 'android';
const isRelease = gutil.env.release;

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

const SRC_WWW = 'src/www';
const DEST_WWW = 'www';

// Copies Babel polyfill from node_modules, as it needs to be included by cordova_index.html.
function copyBabelPolyfill() {
  const babelPolyfill = 'node_modules/babel-polyfill/dist/polyfill.min.js';
  return runCommand(`cp -v ${babelPolyfill} ${DEST_WWW}/babel-polyfill.min.js`);
}

// Bundles code with the entry point www/app/cordova_main.js -> www/cordova_main.js.
//
// Useful Gulp/Browserify examples:
//   https://github.com/gulpjs/gulp/tree/master/docs/recipes
function browserifyAndBabelify() {
  return browserify({entries: `${DEST_WWW}/app/cordova_main.js`, debug: true})
      .transform('babelify', {
        // Transpile code in node_modules, too.
        global: true,
        presets: ['env']
      })
      .bundle()
      // Transform the bundle() output stream into one regular Gulp plugins understand.
      .pipe(source('cordova_main.js'))
      .pipe(gulp.dest(DEST_WWW));
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

// Note: This is currently done "in-place", i.e. the components are downloaded to src/www and
// transpiled there, but this seems to work just fine (idempodent).
function transpileBowerComponents() {
  // Transpile bower_components with the exception of webcomponentsjs, which contains transpiled
  // polyfills, and minified files, which are generally already transpiled.
  const bowerComponentsSrc = [
    `${DEST_WWW}/bower_components/**/*.html`, `${DEST_WWW}/bower_components/**/*.js`,
    `!${DEST_WWW}/bower_components/webcomponentsjs/**/*.js`,
    `!${DEST_WWW}/bower_components/webcomponentsjs/**/*.html`,
    `!${DEST_WWW}/bower_components/**/*.min.js`
  ];
  const bowerComponentsDest = `${DEST_WWW}/bower_components`;
  return transpile(bowerComponentsSrc, bowerComponentsDest);
}

function transpileUiComponents() {
  return transpile([`${SRC_WWW}/ui_components/*.html`], `${DEST_WWW}/ui_components`);
}

function rtlCss() {
  return generateRtlCss(`${SRC_WWW}/ui_components/*.html`, `${DEST_WWW}/ui_components`)
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
  const compileArgs = platform === 'ios' ? '--device' : '';
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
      DEST_WWW}/environment.json`);
}

exports.build = gulp.series(buildWebApp, transpileWebApp, writeEnvJson, packageWithCordova);
