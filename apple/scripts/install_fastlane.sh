#!/bin/bash -eu
#
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

function usage() {
  cat <<-EOM
Installs fastlane, build scripts, and metadata into an Apple platform directory
Usage: $(basename $0) -p [platform]
Options:
  -p  Platform to release [ios|osx]. Default: ios
  -h  Display this message and exit
EOM
exit 1
}

PLATFORM=ios
while getopts :p:h? opt; do
  case $opt in
    p) PLATFORM=$OPTARG ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

PLATFORM_DIR=platforms/$PLATFORM/
if [ ! -d $PLATFORM_DIR ]; then
  # Generate the Xcode project through Cordova.
  yarn gulp build --platform=$PLATFORM --release
fi

# Install the fastlane scripts and metadata.
cp -R apple/fastlane/* $PLATFORM_DIR
pushd $PLATFORM_DIR
bundle install
