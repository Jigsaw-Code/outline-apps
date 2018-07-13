#!/bin/bash -eux
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

# Builds ss-local.exe with the help of shadowsocks-libev's MinGW build
# scripts which have been modified slightly in our mirror to build from
# our mirrored sources.
#
# Requires Docker; tested on Linux.

TMPDIR=$(mktemp -d)
echo "building in $TMPDIR"

mkdir $TMPDIR/src

# Build scripts.
cp third_party/shadowsocks-libev/docker/mingw/* $TMPDIR

# Dependency sources, used by deps.sh.
cp -R third_party/{pcre,mbedtls,sodium,c-ares,libev-mingw} $TMPDIR/src/
# shadowsocks-libev source, used by build.sh.
cp -R third_party/shadowsocks-libev $TMPDIR/src/proj

pushd $TMPDIR
make
popd

cp -v $TMPDIR/ss-local.exe third_party/shadowsocks-libev/windows/
chmod 755 third_party/shadowsocks-libev/windows/ss-local.exe
