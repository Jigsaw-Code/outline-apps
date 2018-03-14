#!/bin/bash -e
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

# Builds Shadowsocks_iOS.framework and Shadowsocks_macOS.framework based on the
# version controlled binaries and headers in the following subdirectories of third_party:
# libev, libshadowsocks-libev, libmbedtls, libsodium, libcares, and libpcre.

echo "Building Shadowsocks frameworks..."
pushd $(dirname $0) > /dev/null

APPLE_DIR=apple
BUILD_DIR=`pwd`/$APPLE_DIR/build
INSTALL_DIR=$APPLE_DIR/frameworks

rm -rf $INSTALL_DIR
mkdir -p  $BUILD_DIR $INSTALL_DIR/ios $INSTALL_DIR/macos
pushd $APPLE_DIR/Shadowsocks > /dev/null

# Build iOS framework
xcodebuild -scheme Shadowsocks_iOS -derivedDataPath $BUILD_DIR build
# Build macOS framework
xcodebuild -scheme Shadowsocks_macOS -derivedDataPath $BUILD_DIR build

popd > /dev/null

# Install
cp -R $BUILD_DIR/Build/Products/Debug/Shadowsocks_macOS.framework \
      $INSTALL_DIR/macos/
cp -R $BUILD_DIR/Build/Products/Debug-iphoneos/Shadowsocks_iOS.framework \
      $INSTALL_DIR/ios/
# Clean up
rm -rf $BUILD_DIR
popd > /dev/null
echo "Installed Shadowsocks_[macOS|iOS].framework to $INSTALL_DIR."
