#!/bin/bash -eu
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

yarn do src/electron/linux/build

mkdir -p build/linux
cp package.json build/linux/
scripts/environment_json.sh -p linux > build/linux/www/environment.json

electron-builder \
  --projectDir=build/linux \
  --config.asarUnpack=electron/bin \
  --x64 \
  --publish=never \
  --linux AppImage \
  --config.linux.category=Network \
  --config.linux.icon=icons/png
