#!/usr/bin/env node

// Copyright 2019 The Outline Authors
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

const fs = require('fs');

// Configures an Android beta release by enabling crash reporting through Firebase Crashlytics.
module.exports = function() {
  console.log('Configuring Android beta build.');
  const betaDir = 'beta';
  const projectDir = 'platforms/android';
  const appDir = `${projectDir}/app`;
  // Override project-level gradle build file.
  fs.copyFileSync(`${betaDir}/build.gradle`, `${projectDir}/build.gradle`);
  fs.copyFileSync(`${betaDir}/build-extras.gradle`, `${appDir}/build-extras.gradle`);
  fs.copyFileSync(`${betaDir}/google-services.json`, `${appDir}/google-services.json`);
}
