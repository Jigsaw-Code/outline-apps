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

echo "Building PacketProcessor frameworks..."

POTATSO_DIR=$ROOT_DIR/third_party/Potatso
BUILD_DIR=$POTATSO_DIR/build
INSTALL_DIR=$POTATSO_DIR/frameworks

rm -rf $INSTALL_DIR
mkdir -p  $BUILD_DIR $INSTALL_DIR/ios $INSTALL_DIR/macos

pushd $POTATSO_DIR > /dev/null

# Install dependencies
pod install

COMMON_XCODE_ARGS="-workspace ShadowPath.xcworkspace -configuration Release only_active_arch=no -derivedDataPath $BUILD_DIR"
# Build iOS framework
xcodebuild $COMMON_XCODE_ARGS -scheme PacketProcessor_iOS -destination "generic/platform=iOS" archive
# Build macOS framework
xcodebuild $COMMON_XCODE_ARGS -scheme PacketProcessor_macOS -destination "platform=macOS,arch=x86_64" archive

# Install
cp -RL $BUILD_DIR/Build/Intermediates.noindex/ArchiveIntermediates/PacketProcessor_iOS/BuildProductsPath/Release-iphoneos/PacketProcessor_iOS.framework \
       $INSTALL_DIR/ios/
cp -RL $BUILD_DIR/Build/Intermediates.noindex/ArchiveIntermediates/PacketProcessor_macOS/BuildProductsPath/Release/PacketProcessor_macOS.framework \
       $INSTALL_DIR/macos/

# Clean up
rm -rf $BUILD_DIR
echo "Installed PacketProcessor_[macOS|iOS].framework to $INSTALL_DIR."
