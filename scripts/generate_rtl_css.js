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

const gulp = require('gulp');
const gutil = require('gulp-util');
const posthtml = require('gulp-posthtml');
const posthtmlcss = require('posthtml-postcss');
const rtl = require('postcss-rtl');
const replace = require('gulp-replace');

// Generates inline CSS RTL mirroring rules for Polymer components.
module.exports = function(src, dest) {
  gutil.log('Generating RTL CSS');
  const plugins = [rtl()];
  const options = {from: undefined, sync: true};
  const filterType = /\/css$/;
  return gulp.src([src])
      .pipe(posthtml([posthtmlcss(plugins, options, filterType)]))
      // Replace the generated selectors with Shadow DOM selectors for Polymer compatibility.
      .pipe(replace('[dir=rtl]', ':host(:dir(rtl))'))
      .pipe(replace('[dir=ltr]', ':host(:dir(ltr))'))
      // rtlcss generates [dir] selectors for rules unaffected by directionality; ignore them.
      .pipe(replace('[dir]', ''))
      .pipe(gulp.dest(dest));
}
