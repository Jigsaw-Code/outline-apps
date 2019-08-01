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

# Builds iOS and macOS Shadowsocks frameworks from shadowsocks-libev source in this directory.
# This script may be used as a routine update to Shadowsocks for Apple. To update shadowsocks-libev
# dependencies, see apple/README.md.

# Update libshadowsocks-libev.a shared library.
yarn do third_party/shadowsocks-libev/apple/libshadowsocks-libev/build
# Build the frameworks.
yarn do third_party/shadowsocks-libev/apple/build
