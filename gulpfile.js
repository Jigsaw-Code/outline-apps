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

const child_process = require('child_process');
const gulp = require('gulp');
const log = require('fancy-log');
const minimist = require('minimist');
const os = require('os');

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
const isBeta = args.beta;

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

function buildWebApp() {
  return runCommand('yarn do src/www/build_cordova');
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

function cordovaMaybeConfigureBeta() {
  if (platform === 'android' && isBeta) {
    require('./beta/configure_android_beta.js')();
    return Promise.resolve();
  }
  return Promise.resolve('Not configuring beta release');
}

function cordovaMaybeUploadSymbols() {
  if (platform === 'android' && isBeta) {
    const buildPath = 'app/build/intermediates/transforms';
    const uploadSymbolsCmd = `cd platforms/android && cp -R ${buildPath}/mergeJniLibs ${
        buildPath}/stripDebugSymbol && ./gradlew crashlyticsUploadSymbols`;
    return runCommand(isRelease ? `${uploadSymbolsCmd}Release` : `${uploadSymbolsCmd}Debug`);
  }
  return Promise.resolve('Not uploading beta crash symbols');
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
  return runCommand(`bash scripts/environment_json.sh -p ${platform} ${isRelease ? '-r' : ''} ${
      isBeta ? '-b' : ''} > ${WEBAPP_OUT}/environment.json`);
}

const setupWebApp = gulp.series(buildWebApp, writeEnvJson);
const setupCordova = gulp.series(cordovaPlatformAdd, cordovaPrepare, xcode);

exports.build = gulp.series(validateBuildEnvironment, setupWebApp, setupCordova, cordovaCompile);
exports.setup = gulp.series(validateBuildEnvironment, setupWebApp, setupCordova);
