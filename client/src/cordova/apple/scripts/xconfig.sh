#!/bin/sh
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

set -e

function usage () {
  echo "Configure an autoconf project for cross-compilation on iOS and macOS."
  echo ""
  echo "Usage: [ENV_VARS] $(basename $0) architecture"
  echo ""
  echo "  architecture   Target architecture. [armv7|armv7s|arm64|x86_64]"
  echo ""
  echo "    SDKVERSION   Target a specific SDK version."
  echo "    MINVERSION   Target a specific minimum OS version, defaults to SDKVERSION."
  echo "    PREFIX       Install prefix."
  echo ""
  echo "    CFLAGS CPPFLAGS CXXFLAGS LDFLAGS "
  echo ""
  echo "  All additional parameters are passed to the configure script."
  exit 1
}

if [ "$#" -lt 1 ]; then
  echo "Architecture is required."
  usage
fi

if [ ! -x "./configure" ] ; then
  echo "No configure script in current directory."
  usage
fi

# Build architecture
export ARCH=$1

# Infer HOST and SDK from architecture
case $ARCH in
  armv7 | armv7s )
    export HOST=arm-apple-darwin*
    export SDK=iphoneos
    ;;
  arm64 )
    export HOST=aarch64-apple-darwin*
    export SDK=iphoneos
    ;;
  x86_64 )
    export HOST=x86_64-apple-darwin*
    export SDK=macosx
    ;;
  * )
    usage
  ;;
esac


# Export supplied SDKVERSION or use system default
if [ ! -z "$SDKVERSION" ]; then
  SDKNAME=$(basename $(xcrun --sdk $SDK --show-sdk-platform-path) .platform)
  export SDKVERSION
  export SDKROOT=$(xcrun --sdk $SDK --show-sdk-platform-path)"/Developer/SDKs/$SDKNAME$SDKVERSION.sdk"
else
  export SDKVERSION=$(xcrun --sdk $SDK --show-sdk-version)
  export SDKROOT=$(xcrun --sdk $SDK --show-sdk-path)
fi

# Export supplied PREFIX
if [ ! -z "$PREFIX" ]; then
  export PREFIX
fi

if [ ! -z "$MINVERSION" ]; then
  export MINVERSION
else
  export MINVERSION=$SDKVERSION  # Default to SDK version
fi

# Binaries
export CC=$(xcrun --sdk $SDK --find gcc)
export CPP=$(xcrun --sdk $SDK --find gcc)" -E"
export CXX=$(xcrun --sdk $SDK --find g++)
export LD=$(xcrun --sdk $SDK --find ld)

# Flags
export CFLAGS="$CFLAGS -arch $ARCH -isysroot $SDKROOT -m$SDK-version-min=$MINVERSION"
export CPPFLAGS="$CPPFLAGS -arch $ARCH -isysroot $SDKROOT -m$SDK-version-min=$MINVERSION"
export CXXFLAGS="$CXXFLAGS -arch $ARCH -isysroot $SDKROOT"
export LDFLAGS="$LDFLAGS -arch $ARCH -isysroot $SDKROOT"

# Remove script parameters
shift 1

./configure \
  --prefix="$PREFIX" \
  --host="$HOST" \
  --enable-static \
  --disable-shared \
  $@
