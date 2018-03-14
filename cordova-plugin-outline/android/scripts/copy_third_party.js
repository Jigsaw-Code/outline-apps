#!/usr/bin/env node

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

const child_process = require('child_process');

module.exports = function(context) {
  console.log('Copying Android third party source code');
  child_process.execSync('cp third_party/sentry-android/*.java plugins/cordova-plugin-outline/android/java/org/outline/log/');
  ['armeabi-v7a', 'x86'].forEach((arch) => {
      child_process.execSync(`cp third_party/shadowsocks-libev/android/libs/${arch}/*.so plugins/cordova-plugin-outline/android/libs/${arch}/`);
  });
}
