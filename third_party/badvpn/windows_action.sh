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

# Builds badvpn-tun2socks.exe, for Windows.
#
# The following dependencies
# should be installed:
# - CMake, from https://cmake.org/download/ (32 bit)
# - mingw-64, from https://mingw-w64.org/doku.php/download (MingW-W64-builds)
#
# Tested on Cygwin (32 bit) under Windows 10.

TMPDIR=$(mktemp -d)
echo "building in $TMPDIR"
cp -R third_party/badvpn $TMPDIR

pushd $TMPDIR/badvpn
# Bizarrely, CMake complains if it finds sh.exe in the path which is most
# definitely the case if you have Cygwin installed. To work around, we'll
# construct a new, temporary path with just cmake and gcc.
IFS="
"
readonly OLDPATH=$PATH
PATH="$(dirname $(which cmake)):$(dirname $(which -a gcc|grep -v cygwin))"

cmake . -G "MinGW Makefiles" -DBUILD_NOTHING_BY_DEFAULT=1 -DBUILD_TUN2SOCKS=1
cmake --build .
popd

PATH=$OLDPATH
cp -v $TMPDIR/badvpn/tun2socks/badvpn-tun2socks.exe third_party/badvpn/windows/
