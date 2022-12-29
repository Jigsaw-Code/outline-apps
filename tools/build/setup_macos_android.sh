#!/bin/bash
#
# Copyright 2022 The Outline Authors
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

set -eu

# Android SDK Build Tools:
#   https://developer.android.com/studio/releases/build-tools.html
# To find the latest version's label:
#   sdkmanager --list|grep build-tools
ANDROID_BUILD_TOOLS_VERSION=${ANDROID_BUILD_TOOLS_VERSION:-"30.0.3"}

# NDK (side by side) version must be kept in sync with the default build tools NDK version.
NDK_VERSION=${NDK_VERSION:-"21.0.6113669"}

function install_jdk() {
  # Cordova Android 10 has to use JDK 11.
  if [[ -d "$HOME/Library/Java/JavaVirtualMachines/jdk-11.0.2.jdk" ]]; then
    echo "JDK already installed"
    return
  fi

  echo "Downloading JDK"
  curl https://download.java.net/java/GA/jdk11/9/GPL/openjdk-11.0.2_osx-x64_bin.tar.gz | tar -xzk -C "$HOME/Library/Java/JavaVirtualMachines/"
}

function install_android_tools() {
  declare -r android_home=${1?Need to pass Android SDK home}
  declare -r cmdline_tools_dir="${android_home}/cmdline-tools/8.0"
  if [[ -d "${cmdline_tools_dir}" ]]; then
    echo "Android command line tools already installed at ${cmdline_tools_dir}"
  else
    # From https://developer.android.com/studio#command-line-tools-only
    echo "Installing Android command-line tools to ${cmdline_tools_dir}"
    declare -r tmp_zip_dir="$(mktemp -d)"
    curl "https://dl.google.com/android/repository/commandlinetools-mac-9123335_latest.zip" --create-dirs --output "${tmp_zip_dir}/tools.zip"
    unzip -q "${tmp_zip_dir}/tools.zip" -d "${tmp_zip_dir}"
    mv "${tmp_zip_dir}/cmdline-tools" "${cmdline_tools_dir}"
    rm -r "${tmp_zip_dir}"
  fi

  echo "Installing build-tools and ndk"
  "${cmdline_tools_dir}/bin/sdkmanager" "build-tools;${ANDROID_BUILD_TOOLS_VERSION}" "ndk;${NDK_VERSION}"
}

function install_gradle() {
  if which gradle > /dev/null; then
    echo "Gradle already installed"
  else
    brew install gradle
  fi
}

function main() {
  # See https://cordova.apache.org/docs/en/11.x/guide/platforms/android/index.html
  # For Cordova Android requirements.

  if [[ "$(uname -s)" != 'Darwin' ]]; then
    echo "Must run from a macOS machine" > 2
    exit 1
  fi
  
  install_jdk
  java -version
  echo

  declare -r android_home="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
  install_android_tools "${android_home}"

  install_gradle
  gradle --version

  echo "Setup done. Make sure to define these environment variables:"
  echo "export ANDROID_SDK_ROOT=${android_home}"
  echo "PATH=$PATH:${ANDROID_SDK_ROOT}/platform-tools:${ANDROID_SDK_ROOT}/cmdline-tools/8.0/bin:${ANDROID_SDK_ROOT}/emulator"
}

main
