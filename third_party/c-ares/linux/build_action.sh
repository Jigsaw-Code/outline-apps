#!/bin/bash -e
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

# Compile c-ares as a static library for Linux.

echo "Building libcares..."
pushd $(dirname $0) > /dev/null

BUILD_DIR=`pwd`/cares
INSTALL_DIR="$BUILD_DIR/bin"

# Copy source from third_party/cares
rsync -a --exclude='linux' --exclude='apple' .. $BUILD_DIR
# Create install directory
mkdir -p $INSTALL_DIR

pushd $BUILD_DIR > /dev/null

./configure --prefix="$INSTALL_DIR"
make install -j

popd > /dev/null
mkdir -p lib include
# Copy libraries
cp $INSTALL_DIR/lib/libcares.a lib
# Copy headers
cp -R $INSTALL_DIR/include/* include

# Clean up
rm -rf $BUILD_DIR
