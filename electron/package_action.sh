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

yarn do electron/build

cp package.json build/windows/
scripts/environment_json.sh -p windows > build/windows/www/environment.json

# Copy tap-windows6.
cp -R third_party/tap-windows6/bin build/windows/tap-windows6

# --config.asarUnpack must be kept in sync with:
#  - the destination path for the binaries in build_action.sh
#  - the value returned by process_manager.ts#pathToEmbeddedExe

# In addition to per-user/per-machine, --config.nsis.perMachine=true
# makes the installer require admin permissions, which are required
# to install and configure the TAP device.

electron-builder \
  --projectDir=build/windows \
  --config.asarUnpack=electron/bin \
  --ia32 \
  --publish=never \
  --win nsis \
  --config.win.icon=icons/win/icon.ico \
  --config.nsis.perMachine=true \
  --config.nsis.include=electron/custom_install_steps.nsh \
  --config.nsis.artifactName='Outline-Client.${ext}'
