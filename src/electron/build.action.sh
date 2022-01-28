#!/bin/bash
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
set -eux

PLATFORM=$1
STAGING_PERCENTAGE=100
BUILD_MODE=debug
for i in "$@"; do
    case $i in
    --buildMode=*)
        BUILD_MODE="${i#*=}"
        shift
        ;;
    --stagingPercentage=*)
        STAGING_PERCENTAGE="${i#*=}"
        shift
        ;;
    -* | --*)
        echo "Unknown option: ${i}"
        exit 1
        ;;
    *) ;;
    esac
done

if ((STAGING_PERCENTAGE <= 0)) || ((STAGING_PERCENTAGE > 100)); then
  echo "Staging percentage must be greater than 0 and no more than 100"
  exit 1
fi

if [[ -n ${SENTRY_DSN:-} ]]; then
    # Build the Sentry URL for the installer by parsing the API key and project ID from $SENTRY_DSN,
    # which has the following format: https://[32_CHAR_API_KEY]@sentry.io/[PROJECT_ID].
    readonly API_KEY=$(echo $SENTRY_DSN | awk -F/ '{print substr($3, 0, 32)}')
    readonly PROJECT_ID=$(echo $SENTRY_DSN | awk -F/ '{print $4}')
    readonly SENTRY_URL="https://sentry.io/api/$PROJECT_ID/store/?sentry_version=7&sentry_key=$API_KEY"
fi

readonly WEBPACK_MODE="$(node scripts/get_webpack_mode.mjs --buildMode=${BUILD_MODE})"

run_action src/www/build "${PLATFORM}" --buildMode="${BUILD_MODE}"

webpack --config=src/electron/webpack_electron_main.js \
    --env NETWORK_STACK="${NETWORK_STACK:-libevbadvpn}" \
    ${WEBPACK_MODE:+--mode="${WEBPACK_MODE}"}

electron-icon-maker --input=resources/electron/icon.png --output=build

# TODO: Move env.sh to build/electron/.
if [[ "${PLATFORM}" == "windows" ]]; then
cat > build/env.nsh << EOF
!define RELEASE "$(node scripts/get_version.mjs windows)"
!define SENTRY_URL "${SENTRY_URL:-}"
EOF
fi

electron-builder $(node scripts/get_electron_build_flags.mjs ${PLATFORM} --buildMode=${BUILD_MODE})


if ((STAGING_PERCENTAGE < 100)); then
    MANIFEST_POSTFIX=
    [[ "${PLATFORM}" == "linux" ]] && MANIFEST_POSTFIX="-linux"

    echo "stagingPercentage: $STAGING_PERCENTAGE" >> build/dist/beta${MANIFEST_POSTFIX}.yml
    echo "stagingPercentage: $STAGING_PERCENTAGE" >> build/dist/latest${MANIFEST_POSTFIX}.yml
fi