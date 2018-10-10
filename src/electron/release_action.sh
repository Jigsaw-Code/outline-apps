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

# Same as package, except:
#  - prod Sentry keys are used
#  - the binary is signed (you'll need the hardware token, its password,
#    and a real Windows box)

yarn do src/electron/build

# Environment variables.
scripts/environment_json.sh -p windows -r > build/windows/www/environment.json
# TODO: Share code with environment_json.sh.
mkdir -p build/windows/build
cat > build/windows/build/env.nsh << EOF
!define RELEASE "$(node -r fs -p 'JSON.parse(fs.readFileSync("package.json")).version;')"
!define SENTRY_DSN "https://sentry.io/api/159502/store/?sentry_version=7&sentry_key=6a1e6e7371a64db59f5ba6c34a77d78c"
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
  --config.publish.provider=generic \
  --config.publish.url=https://raw.githubusercontent.com/Jigsaw-Code/outline-releases/master/client/ \
  --win nsis \
  --config.win.icon=icons/win/icon.ico \
  --config.win.certificateSubjectName='Jigsaw Operations LLC' \
  --config.nsis.perMachine=true \
  --config.nsis.include=electron/custom_install_steps.nsh \
  --config.nsis.artifactName='Outline-Client.${ext}'
