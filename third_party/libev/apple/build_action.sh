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

# Compile libev as a static library for iOS and macOS.

echo "Building libev..."
pushd $(dirname $0) > /dev/null

SRCDIR="libev"
ARCHS="x86_64 armv7 armv7s arm64"

# Copy source from third_party/libev
rsync -a --exclude='apple*' .. $SRCDIR

pushd $SRCDIR > /dev/null
./autogen.sh

for ARCH in $ARCHS
do
  echo "Building $SRCDIR for $ARCH"
  mkdir -p bin/$ARCH

  # SDKs for iOS 10 and macOS 10.12. weakly link the function `clock_gettime`. This means that for
  # earlier OS versions that do not not support it, `clock_gettime` is declared at compile time.
  # At runtime, the dynamic linker is not able to find the function, which results in a crash.
  #
  # To fix this issue, set SDKVERSION to compile with SDKs iOS 9 and macOS 10.11.
  #
  # Install the SDKs:
  #  - Download Xcode 7.0 from https://developer.apple.com/download/more
  #  - Mount the dmg; do not install Xcode. Right click its icon and select 'Show Package Contents'.
  #  - cp -R /Volumes/Xcode/XCode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS9.0.sdk
  #    /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/
  #  - cp -R /Volumes/Xcode/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX10.11.sdk
  #    /Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/
  #  - Change `MinimumSDKVersion` to 9.0 in
  #    /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Info.plist
  #  - Change `MinimumSDKVersion` to 10.11 in
  #    /Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX10.11.sdk/Info.plist
  case $ARCH in
    armv7 | armv7s | arm64 )
      export MINVERSION=9.0
      export SDKVERSION=9.0
      ;;
    x86_64 )
      export MINVERSION=10.11
      export SDKVERSION=10.11
      ;;
    * )
      echo "Unsupported architecture $ARCH"
      exit 1
    ;;
  esac

  export PREFIX="`pwd`/bin/$ARCH"
  ../../../../apple/scripts/xconfig.sh $ARCH
  make -j2 && make install
  make clean
done

popd > /dev/null
mkdir -p lib include

# Copy headers
cp -R $SRCDIR/bin/x86_64/include/ include

# Create FAT binary
lipo -output lib/libev.a -create \
  $SRCDIR/bin/x86_64/lib/libev.a \
  $SRCDIR/bin/armv7/lib/libev.a \
  $SRCDIR/bin/armv7s/lib/libev.a \
  $SRCDIR/bin/arm64/lib/libev.a

# Clean up
rm -rf $SRCDIR*
popd > /dev/null
