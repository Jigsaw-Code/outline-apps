#!/bin/bash -eux

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

# Builds libss-local.so, for Android, with the help of shadowsocks-android.

# Architectures to update, as a space-separated list.
# TODO: Pass this to ndk-build, to reduce compile time.
readonly ARCH="armeabi-v7a x86"

# The shared library's filename.
readonly SO=libss-local.so

# Version of shadowsocks-android with which to compile.
readonly SHADOWSOCKS_ANDROID_VERSION=4.3.3

# Docker image with which to build the binary.
# To rebuild:
# docker build -t quay.io/outline/shadowsocks-libev-android-build third_party/shadowsocks-libev/android/
readonly DOCKER_IMAGE_NAME=quay.io/outline/shadowsocks-libev-android-build

# Clone shadowsocks-android, in a location (/tmp) at which Docker on OSX will
# by default make available to containers.
readonly TEMP=$(mktemp -d /tmp/temp.XXXX)
git clone https://github.com/shadowsocks/shadowsocks-android.git $TEMP
pushd $TEMP
git checkout "v$SHADOWSOCKS_ANDROID_VERSION"
git submodule update --init --recursive
popd

# Use our copy of shadowsocks-libev.
rsync --delete -avu third_party/shadowsocks-libev/ $TEMP/mobile/src/main/jni/shadowsocks-libev/

# Although overture is needed only by shadowsocks-android, not
# shadowsocks-libev, build-ndk will throw an exception if these
# files (one for each architecture specified in Application.mk)
# don't exist.
for arch in armeabi-v7a arm64-v8a x86; do
  mkdir -p $TEMP/mobile/src/main/jni/overture/$arch
  touch $TEMP/mobile/src/main/jni/overture/$arch/liboverture.so
done

# Build!
docker run --rm -ti -v $TEMP:$TEMP -w $TEMP $DOCKER_IMAGE_NAME ndk-build -C mobile/src/main/jni ss-local

# Copy the new binaries into the repo.
for arch in $ARCH; do
  mkdir -p third_party/shadowsocks-libev/android/libs/$arch
  cp $TEMP/mobile/src/main/obj/local/$arch/$SO third_party/shadowsocks-libev/android/libs/$arch/
done
