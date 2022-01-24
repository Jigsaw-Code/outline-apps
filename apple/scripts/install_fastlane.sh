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
Usage: $(basename $0) [platform] --buildMode=[buildMode]
Options:
  platform  Platform to release [ios|osx]. Default: ios
  --buildMode  Mode to build [debug|release].
  ?  Display this message and exit
EOM
exit 1
}

PLATFORM=ios
BUILD_MODE=
for i in "$@"; do
    case $i in
    --buildMode=*)
        BUILD_MODE="${i#*=}"
        shift
        ;;
    -* | --*)
        usage
        exit 1
        ;;
    *) ;;
    esac
done

PLATFORM_DIR=platforms/$PLATFORM/
if [ ! -d $PLATFORM_DIR ]; then
  # Generate the Xcode project through Cordova.
  npm run action gulp -- setup $PLATFORM --buildMode=$BUILD_MODE
fi

# Install the fastlane scripts and metadata.
cp -R apple/fastlane/* $PLATFORM_DIR
pushd $PLATFORM_DIR
bundle install
