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
#  - the binary is signed (you'll need the hardware token, its password, and a real Windows box)
#  - auto-updates are configured

yarn do src/electron/package_common

scripts/environment_json.sh -r -p windows > www/environment.json

# TODO: Share code with environment_json.sh (this is the dev/debug Sentry DSN).
# TODO: Move env.sh to build/electron/.
cat > build/env.nsh << EOF
!define RELEASE "$(scripts/semantic_version.sh -p windows)"
!define SENTRY_DSN "https://sentry.io/api/159502/store/?sentry_version=7&sentry_key=6a1e6e7371a64db59f5ba6c34a77d78c"
EOF

electron-builder \
  --win \
  --publish never \
  --config src/electron/electron-builder.json \
  --config.extraMetadata.version=$(scripts/semantic_version.sh -p windows) \
  --config.publish.provider=generic \
  --config.publish.url=https://raw.githubusercontent.com/Jigsaw-Code/outline-releases/master/client/ \
  --config.win.certificateSubjectName='Jigsaw Operations LLC'
