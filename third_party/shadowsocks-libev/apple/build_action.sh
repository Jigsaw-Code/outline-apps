#!/bin/bash
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

echo "Building Shadowsocks frameworks..."

SHADOWSOCKS_DIR=$ROOT_DIR/third_party/shadowsocks-libev/apple
BUILD_DIR=$SHADOWSOCKS_DIR/build
INSTALL_DIR=$SHADOWSOCKS_DIR/frameworks

rm -rf $INSTALL_DIR
mkdir -p  $BUILD_DIR $INSTALL_DIR/ios $INSTALL_DIR/macos

pushd $SHADOWSOCKS_DIR > /dev/null

COMMON_XCODE_ARGS="-project Shadowsocks/Shadowsocks.xcodeproj -configuration Release only_active_arch=no -derivedDataPath $BUILD_DIR"
# Build iOS framework
xcodebuild $COMMON_XCODE_ARGS -scheme Shadowsocks_iOS -destination "generic/platform=iOS" archive
# Build macOS framework
xcodebuild $COMMON_XCODE_ARGS -scheme Shadowsocks_macOS -destination "platform=macOS,arch=x86_64" archive

# Install
cp -RL $BUILD_DIR/Build/Intermediates.noindex/ArchiveIntermediates/Shadowsocks_iOS/BuildProductsPath/Release-iphoneos/Shadowsocks_iOS.framework \
       $INSTALL_DIR/ios/
cp -RL $BUILD_DIR/Build/Intermediates.noindex/ArchiveIntermediates/Shadowsocks_macOS/BuildProductsPath/Release/Shadowsocks_macOS.framework \
       $INSTALL_DIR/macos/

# Clean up
rm -rf $BUILD_DIR
echo "Installed Shadowsocks_[macOS|iOS].framework to $INSTALL_DIR."
