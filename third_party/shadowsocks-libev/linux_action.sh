#!/bin/bash -eux
#
# Copyright 2019 The Outline Authors
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

THIRD_PARTY_DIR=$ROOT_DIR/third_party
LIBEV_DIR=$THIRD_PARTY_DIR/libev/linux
MBEDTLS_DIR=$THIRD_PARTY_DIR/mbedtls/linux
PCRE_DIR=$THIRD_PARTY_DIR/pcre/linux
LIBSODIUM_DIR=$THIRD_PARTY_DIR/sodium/linux
CARES_DIR=$THIRD_PARTY_DIR/c-ares/linux
INSTALL_DIR=$(mktemp -d /tmp/temp.XXXX)

echo "Building shadowsocks-libev (ss-local) for Linux..."
pushd $(dirname $0) > /dev/null

# Build in-place due to lack of support to build out of tree in libcork.
./autogen.sh
./configure --with-mbedtls=$MBEDTLS_DIR --with-pcre=$PCRE_DIR \
	--with-sodium=$LIBSODIUM_DIR --with-cares=$CARES_DIR --with-ev=$LIBEV_DIR \
	--prefix=$INSTALL_DIR --disable-documentation
make install -j

# Copy binary
cp $INSTALL_DIR/bin/ss-local linux/

# Clean up
make clean
