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

PLATFORM="${1:-}"
FLAVOR="${2:-}"

# TODO: delegate flavor to development/production

npm run action src/www/build_electron "${FLAVOR}"

MODE=
case FLAVOR in
    debug)
    MODE=development
    ;;
    release)
    MODE=production
    ;;
esac

webpack --config=src/electron/electron_main.webpack.js \
    --env NETWORK_STACK="${NETWORK_STACK:-go}" \
    ${MODE:+--mode="${MODE}"}

# Environment variables.
# TODO: make non-packaged builds work without this
node scripts/environment_json.mjs \
    --platform="${PLATFORM}" \
    --flavor="${FLAVOR}" > www/environment.json
