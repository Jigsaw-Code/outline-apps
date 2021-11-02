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

npm run action src/www/build_electron

webpack --config=src/electron/electron_main.webpack.js \
    --env NETWORK_STACK="${NETWORK_STACK:-libevbadvpn}" \
    ${BUILD_ENV:+--mode="${BUILD_ENV}"}

# Environment variables.
# TODO: make non-packaged builds work without this
scripts/environment_json.sh -p dev > www/environment.json
