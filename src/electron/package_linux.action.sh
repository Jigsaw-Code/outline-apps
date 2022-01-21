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
BUILD_MODE=debug
for i in "$@"; do
    case $i in
    -* | --*)
        echo "Unknown option: ${i}"
        exit 1
        ;;
    *) ;;
    esac
done

npm run action src/electron/package_common -- linux --buildMode="${BUILD_MODE}"

electron-builder \
  --linux \
  --publish never \
  --config src/electron/electron-builder.json \
  --config.extraMetadata.version=$(node scripts/get_version.mjs linux)
