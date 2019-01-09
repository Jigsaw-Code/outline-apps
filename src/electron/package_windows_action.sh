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

yarn do src/electron/package_common

# TODO: Share code with environment_json.sh (this is the dev/debug Sentry DSN).
# TODO: Move env.sh to build/electron/.
cat > build/env.nsh << EOF
!define RELEASE "$(scripts/semantic_version.sh -p dev)"
!define SENTRY_DSN "https://sentry.io/api/159503/store/?sentry_version=7&sentry_key=319145c481df41458bb6e84c1a99c9ff"
EOF

electron-builder \
  --win \
  --publish never \
  --config src/electron/electron-builder.json \
  --config.extraMetadata.version=$(scripts/semantic_version.sh -p dev)
