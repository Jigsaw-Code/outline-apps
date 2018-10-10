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

yarn do src/electron/build

# Environment variables.
scripts/environment_json.sh -p windows > build/windows/www/environment.json
# TODO: Share code with environment_json.sh (this is the dev/debug Sentry DSN).
mkdir -p build/windows/build
cat > build/windows/build/env.nsh << EOF
!define RELEASE "$(node -r fs -p 'JSON.parse(fs.readFileSync("package.json")).version;')"
!define SENTRY_DSN "https://sentry.io/api/159503/store/?sentry_version=7&sentry_key=319145c481df41458bb6e84c1a99c9ff"
EOF

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
