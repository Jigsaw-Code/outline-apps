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
  child_process.execSync('cp -R third_party/CocoaAsyncSocket/macos/CocoaAsyncSocket.framework plugins/cordova-plugin-outline/apple/lib/macos/');
  child_process.execSync('cp -R third_party/CocoaLumberjack/macos/CocoaLumberjack.framework plugins/cordova-plugin-outline/apple/lib/macos/');
  child_process.execSync('cp -R third_party/CocoaLumberjack/macos/CocoaLumberjackSwift.framework plugins/cordova-plugin-outline/apple/lib/macos/');
  child_process.execSync('cp -R third_party/Potatso/frameworks/macos/PacketProcessor_macos.framework plugins/cordova-plugin-outline/apple/lib/macos/');
  child_process.execSync('cp -R third_party/sentry-cocoa/macos/Sentry.framework plugins/cordova-plugin-outline/apple/lib/macos/');
  child_process.execSync('cp -R third_party/shadowsocks-libev/apple/frameworks/macos/Shadowsocks_macOS.framework plugins/cordova-plugin-outline/apple/lib/macos/');
}
