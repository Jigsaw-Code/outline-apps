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

# Compile shadowsocks-libev as a static library for iOS and macOS.

echo "Building libshadowsocks-libev..."
pushd $(dirname $0) > /dev/null

ARCHS="x86_64 armv7 armv7s arm64"
SRCDIR=shadowsocks-libev
TOP_LEVEL_DIR=$(cd ../../../..; pwd)
THIRD_PARTY_DIR=$TOP_LEVEL_DIR/third_party
LIBEV_DIR=$THIRD_PARTY_DIR/libev/apple
MBEDTLS_DIR=$THIRD_PARTY_DIR/mbedtls/apple
PCRE_DIR=$THIRD_PARTY_DIR/pcre/apple
LIBSODIUM_DIR=$THIRD_PARTY_DIR/sodium/apple
CARES_DIR=$THIRD_PARTY_DIR/c-ares/apple

# Copy source from third_party/shadowsocks-libev
rsync -a --exclude='android*' --exclude='apple*' --exclude='windows*' ../.. $SRCDIR
pushd $SRCDIR  > /dev/null
./autogen.sh

echo "Patching libcork/src/libcork/posix/env.c for iOS compatibility..."
patch -p1 libcork/src/libcork/posix/env.c < ../libcork_env.patch

export LIBS="-pthread -lm"
export LDFLAGS="-L$LIBEV_DIR/lib -lresolv"
export CFLAGS="-I$LIBEV_DIR/include"

for ARCH in $ARCHS
do
  echo "Building shadowsocks-libev for $ARCH"
  mkdir -p bin/$ARCH

  case $ARCH in
    armv7 | armv7s | arm64 )
      export MINVERSION=9.0
      ;;
    x86_64 )
      export MINVERSION=10.11
      ;;
    * )
      echo "Unsupported architecture $ARCH"
      exit 1
    ;;
  esac

  $TOP_LEVEL_DIR/apple/scripts/xconfig.sh $ARCH --disable-ssp --disable-documentation \
      --with-mbedtls=$MBEDTLS_DIR --with-pcre=$PCRE_DIR \
      --with-sodium=$LIBSODIUM_DIR --with-cares=$CARES_DIR \
      --prefix="`pwd`/bin/$ARCH"
  make -j2 && make install
  make distclean > /dev/null || true
done

popd > /dev/null
mkdir -p lib include

# Copy headers
cp -R $SRCDIR/bin/x86_64/include/ include

# Create FAT binary
lipo -output lib/libshadowsocks-libev.a -create \
  $SRCDIR/bin/x86_64/lib/libshadowsocks-libev.a \
  $SRCDIR/bin/armv7/lib/libshadowsocks-libev.a \
  $SRCDIR/bin/armv7s/lib/libshadowsocks-libev.a \
  $SRCDIR/bin/arm64/lib/libshadowsocks-libev.a

# Clean up
rm -rf $SRCDIR
popd > /dev/null
