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
const polymer_build = require('polymer-build');
const source = require('vinyl-source-stream');

const SRC_WWW = 'src/www';
const DEST_WWW = 'www';

const CONFIG_BY_PLATFORM = {
  android: {platformArgs: '--gradleArg=-PcdvBuildMultipleApks=true'},
  browser: {},
  ios: {compileArgs: '--device'},
  osx: {}
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
      .pipe(gulpif(/\.js$/, babel({presets: [babel_preset_env.default()]})))
      .pipe(sourcesHtmlSplitter.rejoin())
      .pipe(gulp.dest(dest));
}

// Note: This is currently done "in-place", i.e. the components are downloaded to src/www and
// transpiled there, but this seems to work just fine (idempodent).
function transpileBowerComponents() {
  gutil.log('Transpiling Bower components');
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
  gutil.log('Transpiling UI components');
  return transpile([`${SRC_WWW}/ui_components/*.html`], `${DEST_WWW}/ui_components`);
}

// See https://www.typescriptlang.org/docs/handbook/gulp.html
function getBrowserifyInstance() {
  return browserify({
    basedir: '.',
    debug: true,
    entries: [`${DEST_WWW}/app/cordova_main.js`],
    cache: {},
    packageCache: {}
  });
}

function bundleJs(browserifyInstance) {
  gutil.log('Running browserify');
  const log = gutil.log.bind(gutil, 'Browserify Error:');
  const bundle = browserifyInstance.bundle();
  bundle.once('error', function(...args) {
    log(...args);
    return process.exit(1);
  });
  return bundle.pipe(source('cordova_main.js'));
}

function runCommand(command, options, done) {
  gutil.log(`Running ${command}`);
  let child = child_process.exec(command, options, function(err, stdout, stderr) {
    if (done) {
      done(err);
    }
  });
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
}

// Copies Babel polyfill from node_modules, as it needs to be included by cordova_index.html.
function copyBabelPolyfill() {
  const babelPolyfill = 'node_modules/babel-polyfill/dist/polyfill.min.js';
  runCommand(`cp -v ${babelPolyfill} ${DEST_WWW}/babel-polyfill.min.js`, {}, function() {
    gutil.log(`Copied Babel polyfill.`);
  });
}

// Writes a JSON file accessible to environment.ts containing environment variables.
function writeEnvJson(platform, isRelease) {
  // bash for Windows' (Cygwin's) benefit (sh can *not* run this script, at least on Alpine).
  runCommand(
      `bash scripts/environment_json.sh -p ${platform} ${isRelease ? '-r' : ''} > ${
          DEST_WWW}/environment.json`,
      {}, function() {
        gutil.log(`Wrote environment.json`);
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

gulp.task('build', function() {
  const platform = gutil.env.platform || DEFAULT_PLATFORM;
  const config = getConfigByPlatform(platform);
  gutil.log(`Building for platform ${platform}...`);
  build(platform, config);
});

function build(platform, config) {
  const envVars = getReleaseEnvironmentVariables(platform);
  const browserifyInstance = getBrowserifyInstance().transform('babelify', {
    global: true,  // Transpile required node modules
    presets: ['env']
  });

  // Build the web app.
  child_process.execSync('yarn do src/www/build', {stdio: 'inherit'});

  // Bundle the code starting at www/app/cordova_main.js -> www/cordova_main.js.
  return bundleJs(browserifyInstance).pipe(gulp.dest(DEST_WWW)).on('finish', () => {
    copyBabelPolyfill();
    transpileBowerComponents().on('finish', function() {
      transpileUiComponents().on('finish', function() {
        generateRtlCss(`${SRC_WWW}/ui_components/*.html`, `${DEST_WWW}/ui_components`)
            .on('finish', function() {
              // cordova-custom-config isn't invoked as part of "cordova prepare" unless,
              // beforehand, the platform has been added.
              runCommand(
                  `test -d platforms/${platform} || cordova platform add ${platform}`, {},
                  function() {
                    // Between them, "cordova prepare" and "cordova compile" will pull this out of
                    // www/ into platforms/<platform>/www/.
                    writeEnvJson(platform, envVars.RELEASE);

                    // cordova build == cordova prepare + cordova compile
                    runCommand(`cordova prepare ${platform}`, {}, function() {
                      const compileArgs = config.compileArgs || '';
                      const releaseArgs =
                          envVars.RELEASE ? getReleaseCompileArgs(platform, envVars) : '';
                      const platformArgs = config.platformArgs || '';
                      // Do this now, otherwise "cordova compile" fails.
                      // TODO: use some gulp plugin
                      // -c means "use file's checksum, not last modified time"
                      const syncXcode = platform === 'ios' || platform === 'osx' ?
                          `rsync -avzc apple/xcode/${platform}/ platforms/${platform}/` :
                          ':';
                      runCommand(syncXcode, {}, () => {
                        runCommand(`cordova compile ${platform} ${compileArgs} ${releaseArgs} -- ${
                            platformArgs}`);
                      });
                    });
                  });
            });
      });
    });
  });
}
