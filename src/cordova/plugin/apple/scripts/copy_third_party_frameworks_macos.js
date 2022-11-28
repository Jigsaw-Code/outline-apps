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
  console.log('Copying macOS third party frameworks');
  child_process.execSync('mkdir -p plugins/cordova-plugin-outline/apple/lib/macos');
  child_process.execSync('cp -R third_party/CocoaLumberjack/Carthage/Build/CocoaLumberjack.xcframework plugins/cordova-plugin-outline/apple/lib/macos');
  child_process.execSync('cp -R third_party/CocoaLumberjack/Carthage/Build/CocoaLumberjackSwift.xcframework plugins/cordova-plugin-outline/apple/lib/macos');
  child_process.execSync(
      'cp -R third_party/outline-go-tun2socks/apple/Tun2socks.xcframework plugins/cordova-plugin-outline/apple/lib/macos/');
  child_process.execSync('cp -R third_party/sentry-cocoa/Carthage/Build/Sentry.xcframework plugins/cordova-plugin-outline/apple/lib/macos/');
}
