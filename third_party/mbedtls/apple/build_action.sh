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

# Compile mbedtls as a static library for iOS and macOS.

echo "Building libmbedtls..."
pushd $(dirname $0) > /dev/null

ARCHS="x86_64 armv7 armv7s arm64"
SRCDIR="mbedtls"
INCLUDEDIR=`pwd`/$SRCDIR/include

# Copy source from third_party/mbedtls
rsync -a --exclude='apple*' .. $SRCDIR

pushd $SRCDIR/library  > /dev/null

echo "Patching Makefile..."
sed -i.bak '4d' Makefile

for ARCH in $ARCHS
do
  echo "Building $SRCDIR for $ARCH"
  mkdir -p ../bin/$ARCH

  case $ARCH in
    armv7 | armv7s | arm64 )
      SDK=iphoneos
      MINVERSION=9.0
      ;;
    x86_64 )
      SDK=macosx
      MINVERSION=10.11
      ;;
    * )
      echo "Unsupported architecture $ARCH"
      exit 1
    ;;
  esac

  SDKROOT=$(xcrun --sdk $SDK --show-sdk-path)
  export CFLAGS="-arch $ARCH -pipe -no-cpp-precomp -isysroot $SDKROOT -m$SDK-version-min=$MINVERSION"
  export LDFLAGS="-arch $ARCH -pipe -no-cpp-precomp -isysroot $SDKROOT -I$INCLUDEDIR"
  make -j2

  # Copy all static libraries.
  cp libmbedtls.a ../bin/$ARCH/libmbedtls.a
  cp libmbedcrypto.a ../bin/$ARCH/libmbedcrypto.a
  cp libmbedx509.a ../bin/$ARCH/libmbedx509.a

  make clean
done

popd > /dev/null
mkdir -p lib include

# Copy headers
cp -R $INCLUDEDIR/mbedtls/ include/mbedtls

# Create FAT binaries
lipo -output lib/libmbedtls.a -create \
    $SRCDIR/bin/x86_64/libmbedtls.a \
    $SRCDIR/bin/armv7/libmbedtls.a  \
    $SRCDIR/bin/armv7s/libmbedtls.a \
    $SRCDIR/bin/arm64/libmbedtls.a
lipo -output lib/libmbedcrypto.a -create \
    $SRCDIR/bin/x86_64/libmbedcrypto.a \
    $SRCDIR/bin/armv7/libmbedcrypto.a  \
    $SRCDIR/bin/armv7s/libmbedcrypto.a \
    $SRCDIR/bin/arm64/libmbedcrypto.a
lipo -output lib/libmbedx509.a -create \
    $SRCDIR/bin/x86_64/libmbedx509.a \
    $SRCDIR/bin/armv7/libmbedx509.a  \
    $SRCDIR/bin/armv7s/libmbedx509.a \
    $SRCDIR/bin/arm64/libmbedx509.a

# Clean up
rm -rf $SRCDIR*
popd > /dev/null
