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
const babelify = require('babelify');
const babel_preset_env = require('babel-preset-env');
const child_process = require('child_process');
const fs = require('fs');
const generateRtlCss = require('./scripts/generate_rtl_css.js');
const gulp = require('gulp');
const gulpif = require('gulp-if');
const gutil = require('gulp-util');
const merge_stream = require('merge-stream');
const polymer_build = require('polymer-build');
const source = require('vinyl-source-stream');
const watchify = require('watchify');

const SRC_DIR = 'www';

const CONFIG_BY_PLATFORM = {
  android: {
    targetDir: `platforms/android/app/src/main/assets/${SRC_DIR}`,
    platformArgs: '--gradleArg=-PcdvBuildMultipleApks=true'
  },
  browser: {targetDir: `platforms/browser/${SRC_DIR}`},
  ios: {targetDir: `platforms/ios/${SRC_DIR}`, compileArgs: '--device'},
  osx: {targetDir: `platforms/osx/${SRC_DIR}`}
};

function getConfigByPlatform(platform) {
  const config = CONFIG_BY_PLATFORM[platform];
  if (!config) {
    throw new Error(`Unexpected platform: ${platform}`);
  }
  return config;
}

// Transpiles to |src| to ES5, copying the output to |dest|.
function transpile(src, dest) {
  const sourcesHtmlSplitter = new polymer_build.HtmlSplitter();
  return gulp.src(src)
    .pipe(sourcesHtmlSplitter.split())
    .pipe(gulpif(/\.js$/,
          babel({
            presets: [babel_preset_env.default()]
          })))
    .pipe(sourcesHtmlSplitter.rejoin())
    .pipe(gulp.dest(dest));
}

function transpileBowerComponents(config){
  gutil.log('Transpiling Bower components');
  // Transpile bower_components with the exception of webcomponentsjs, which contains transpiled
  // polyfills, and minified files, which are generally already transpiled.
  const bowerComponentsSrc = [
    'www/bower_components/**/*.html',
    'www/bower_components/**/*.js',
    '!www/bower_components/webcomponentsjs/**/*.js',
    '!www/bower_components/webcomponentsjs/**/*.html',
    '!www/bower_components/**/*.min.js'
  ];
  const bowerComponentsDest = `${config.targetDir}/bower_components`;
  return transpile(bowerComponentsSrc, bowerComponentsDest);
}

function transpileUiComponents(config) {
  gutil.log('Transpiling UI components');
  return transpile(['www/ui_components/*.html'], `${config.targetDir}/ui_components`);
}

// See https://www.typescriptlang.org/docs/handbook/gulp.html
function getBrowserifyInstance() {
  return browserify({
      basedir: '.',
      debug: true,
      entries: [`${SRC_DIR}/app/cordova_main.js`],
      cache: {},
      packageCache: {}
  });
}

function bundleJs(browserifyInstance) {
  gutil.log('Running browserify');
  const notWatch = !gutil.env.watch;
  const log = gutil.log.bind(gutil, 'Browserify Error:');
  const bundle = browserifyInstance.bundle();
  bundle.once('error', function (...args) {
    log(...args);
    if (notWatch) {
      return process.exit(1);
    }
  });
  return bundle.pipe(source('cordova_main.js'));
}

// TODO: watch for changes in .html files too, not just .ts files
function watch(browserifyInstance, config) {
  const log = gutil.log.bind(gutil, 'Browserify:');
  const watchified = watchify(browserifyInstance);
  watchified.on('log', log);
  watchified.on('update', function (deps) {
    gutil.log(`The following dependencies were modified, rebuilding...
      ${deps}`);
    bundleJs(watchified).pipe(gulp.dest(config.targetDir));
    gutil.log('Rebuilt');
  });
  return browserifyInstance;
}

function runCommand(command, options, done) {
  gutil.log(`Running ${command}`);
  let child = child_process.exec(command, options, function(err, stdout, stderr) {
    if (done) { done(err); }
  });
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
}

// Copies Babel polyfill from node_modules, as it needs to be included by cordova_index.html.
function copyBabelPolyfill(config) {
  const babelPolyfill = 'node_modules/babel-polyfill/dist/polyfill.min.js';
  runCommand(`cp -v ${babelPolyfill} ${config.targetDir}/babel-polyfill.min.js`, {}, function () {
    gutil.log(`Copied Babel polyfill.`);
  });
}

// Writes a JSON file accessible to environment.ts containing environment variables.
function writeEnvJson(platform, config, isRelease) {
  const platformPath = `platforms/${platform}`;
  if (!fs.existsSync(platformPath)) {
    throw new Error(`Failed to set up environment, no such path: ${platformPath}`);
  }
  if (!fs.existsSync(config.targetDir)) {
    throw new Error(`Failed to set up environment, no such path: ${config.targetDir}`);
  }
  const envFile = `${config.targetDir}/environment.json`;
  let envScript  = 'scripts/environment_json.sh';
  if (process.platform.includes('win')) {
    envScript = `sh ${envScript}`;
  }
  runCommand(`${envScript} -p ${platform} ${isRelease ? '-r' : ''} > ${envFile}`, {}, function() {
    gutil.log(`Wrote ${envFile}`);
  });
}

// Expected environment variables when the release flag is set.
const RELEASE_ENVIRONMENT_KEYS = {
  KEYALIAS: 'KEYALIAS',
  KEYPASS: 'KEYPASS',
  KEYSTORE: 'KEYSTORE',
  STOREPASS: 'STOREPASS'
};

// Retrieves the environment variables passed as arguments to gulp.
// Validates that the expected variables exist on the given environment.
function getReleaseEnvironmentVariables(platform) {
  let envVars = {};
  envVars.RELEASE = gutil.env.release;
  if (platform === 'android' && envVars.RELEASE) {
    for (const envKey in RELEASE_ENVIRONMENT_KEYS) {
      const envVar = gutil.env[envKey];
      if (!envVar) {
        throw new Error(`Missing environment variable ${envKey}`);
      }
      envVars[envKey] = envVar;
    }
  }
  return envVars;
}

function getReleaseCompileArgs(platform, envVars) {
  if (platform !== 'android') {
    return '--release';
  }
  return `--release -- --keystore=${envVars.KEYSTORE} ` +
    `--storePassword=${envVars.STOREPASS} --alias=${envVars.KEYALIAS} ` +
    `--password=${envVars.KEYPASS}`;
}

const DEFAULT_PLATFORM = 'android';

gulp.task('build', function () {
  const platform = gutil.env.platform || DEFAULT_PLATFORM;
  const config = getConfigByPlatform(platform);
  gutil.log(`Building for platform ${platform}...`);
  build(platform, config);
});

function build(platform, config) {
  const envVars = getReleaseEnvironmentVariables(platform);
  const shouldWatch = !!gutil.env.watch;
  let browserifyInstance = getBrowserifyInstance().transform("babelify", {
    global: true,  // Transpile required node modules
    presets: ['env']
  });
  if (shouldWatch) {
    browserifyInstance = watch(browserifyInstance, config);
  }

  // Build the web app.
  child_process.execSync('yarn do src/www/build');

  return merge_stream(
    bundleJs(browserifyInstance).pipe(gulp.dest(SRC_DIR))
  ).on('finish', () => {
    // cordova-custom-config isn't be invoked as part of "cordova prepare"
    // unless, beforehand, the platform has been added.
    runCommand(`test -d platforms/${platform} || cordova platform add ${platform}`, {}, function () {
      // cordova build == cordova prepare + cordova compile
      runCommand(`cordova prepare ${platform}`, {}, function () {
        copyBabelPolyfill(config);
        writeEnvJson(platform, config, envVars.RELEASE);
        transpileBowerComponents(config).on('finish', function() {
          transpileUiComponents(config).on('finish', function() {
            generateRtlCss(
                `${config.targetDir}/ui_components/*.html`, `${config.targetDir}/ui_components`)
                .on('finish', function() {
                  const compileArgs = config.compileArgs || '';
                  const releaseArgs = envVars.RELEASE ? getReleaseCompileArgs(platform, envVars) : '';
                  const platformArgs = config.platformArgs || '';
                  // Do this now, otherwise "cordova compile" fails.
                  // TODO: use some gulp plugin
                  // -c means "use file's checksum, not last modified time"
                  const syncXcode = platform === 'ios' || platform === 'osx' ?
                      `rsync -avzc apple/xcode/${platform}/ platforms/${platform}/` :
                      ':';
                  runCommand(syncXcode, {}, () => {
                    runCommand(
                        `cordova compile ${platform} ${compileArgs} ${releaseArgs} -- ${platformArgs}`,
                        {}, function() {
                          if (shouldWatch) {
                            gutil.log('Running...');
                            runCommand(`cordova run ${platform} --noprepare --nobuild`);
                          } else {
                            gutil.log('Done');
                          }
                        });
                  });
                });
          });
        });
      });
    });
  });
}
