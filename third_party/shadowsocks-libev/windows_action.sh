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

# Builds ss-local.exe, for Windows.
#
# Tested on Cygwin (32 bit) under Windows 10 with the following packages:
# - gcc-core
# - gcc-g++
# - make
#
# Each package is installed to /usr/local. This makes it a kind of
# scratch directory. To get a totally fresh build, you'll probably
# want to nuke that folder first.
#
# BTW, the order in which the dependencies appear here is the same as
# shadowsocks-libev's configure script searches for them.

TMPDIR=$(mktemp -d)
echo "building in $TMPDIR"
cp -R third_party/{pcre,mbedtls,sodium,c-ares,libev,shadowsocks-libev} $TMPDIR

# PCRE
pushd $TMPDIR/pcre
./autogen.sh
./configure --enable-static --disable-shared
make
make install
popd

# mbed TLS
pushd $TMPDIR/mbedtls
make no_test # no_test avoids the need for Perl
make install
popd

# Sodium.
pushd $TMPDIR/sodium
./autogen.sh
./configure --enable-static --disable-shared
make
make install
popd

# c-ares.
pushd $TMPDIR/c-ares
./buildconf
./configure --enable-static --disable-shared
make
make install
popd

# libev.
pushd $TMPDIR/libev
./autogen.sh
./configure --enable-static --disable-shared
make
make install
popd

# shadowsocks-libev.
pushd $TMPDIR/shadowsocks-libev
./autogen.sh
./configure --disable-documentation
make
popd
cp -v $TMPDIR/shadowsocks-libev/src/ss-local.exe third_party/shadowsocks-libev/windows/
