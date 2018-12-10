#!/bin/bash -eu

# Copyright 2018 The Outline Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

TYPE=dev
PLATFORM=

function usage () {
  echo "$0 [-r] [-h]"
  echo "  -r: use prod Sentry keys"
  echo "  -p: platform (android, ios, osx, browser, windows, or linux)"
  echo "  -h: this help message"
  echo
  echo "Examples:"
  echo "  $0 -p android -r"
  exit 1
}

while getopts rp:h? opt; do
  case $opt in
    r) TYPE=release ;;
    p) PLATFORM=$OPTARG ;;
    h) usage ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

function pull_from_config_xml() {
  cat << EOM | node
const fs = require('fs');
const xml2js = require('xml2js');
const s = fs.readFileSync('config.xml');
xml2js.parseString(s, function(err, result) {
  console.log($1);
});
EOM
}

function pull_from_plist() {
  cat << EOM | node
const fs = require('fs');
const xml2js = require('xml2js');
const s = fs.readFileSync('$1');
xml2js.parseString(s, function(err, result) {
  const dict = result['plist']['dict'][0];
  const keys = dict['key'];
  const values = dict['string'];
  console.log(values[keys.indexOf('$2')]);
});
EOM
}

function pull_from_ios_plist() {
  pull_from_plist "apple/xcode/ios/Outline/Outline-Info.plist" $1
}

function pull_from_osx_plist() {
  pull_from_plist "apple/xcode/osx/Outline/Outline-Info.plist" $1
}

case $PLATFORM in
  android | browser)
    APP_VERSION=$(pull_from_config_xml 'result.widget.$["version"]')
    APP_BUILD_NUMBER=$(pull_from_config_xml 'result.widget.$["android-versionCode"]')
    ;;
  ios)
    APP_VERSION=$(pull_from_ios_plist CFBundleShortVersionString)
    APP_BUILD_NUMBER=$(pull_from_ios_plist CFBundleVersion)
    ;;
  osx)
    APP_VERSION=$(pull_from_osx_plist CFBundleShortVersionString)
    APP_BUILD_NUMBER=$(pull_from_osx_plist CFBundleVersion)
    ;;
  windows | linux)
    APP_VERSION=$(node -r fs -p 'JSON.parse(fs.readFileSync("package.json")).version;')
    APP_BUILD_NUMBER="NA"
    ;;
  *) usage ;;
esac

cat << EOM
{
  "APP_VERSION": "$APP_VERSION",
  "APP_BUILD_NUMBER": "$APP_BUILD_NUMBER",
  "SENTRY_DSN": "$(pull_from_config_xml result.widget.sentry[0].$TYPE[0].$.dsn)",
  "SENTRY_NATIVE_DSN": "$(pull_from_config_xml result.widget.sentry[0][\"$TYPE-native\"][0].$.dsn)"
}
EOM
