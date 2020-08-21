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

function usage () {
  echo "$0 [-s stagingPercentage]" 1>&2
  echo "  -s: The staged rollout percentage for this release.  Must be in the interval (0, 100].  Defaults to 100" 1>&2
  echo "  -h: this help message" 1>&2
  echo 1>&2
  echo "Examples:" 1>&2
  echo "Releases the beta of Windows version 1.2.3 to 10% of users listening on the beta channel" 1>&2
  echo "TRAVIS_TAG=win-v1.2.3-beta  $0 -s 10" 1>&2
  exit 1
}

STAGING_PERCENTAGE=100
while getopts s:? opt; do
  case $opt in
    s) STAGING_PERCENTAGE=$OPTARG ;;
    *) usage ;;
  esac
done

if ((STAGING_PERCENTAGE <= 0)) || ((STAGING_PERCENTAGE > 100)); then
  echo "Staging percentage must be greater than 0 and no more than 100"
  exit 1
fi

TAG=$(scripts/get_tag.sh windows)
if [[ $TAG =~ ^.*-beta$ ]]; then
  INFO_FILE_CHANNEL="beta"
else
  INFO_FILE_CHANNEL=""
fi

yarn do src/electron/package_common

scripts/environment_json.sh -r -p windows > www/environment.json

# Build the Sentry URL for the installer by parsing the API key and project ID from $SENTRY_DSN,
# which has the following format: https://[32_CHAR_API_KEY]@sentry.io/[PROJECT_ID].
readonly API_KEY=$(echo $SENTRY_DSN | awk -F/ '{print substr($3, 0, 32)}')
readonly PROJECT_ID=$(echo $SENTRY_DSN | awk -F/ '{print $4}')
readonly SENTRY_URL="https://sentry.io/api/$PROJECT_ID/store/?sentry_version=7&sentry_key=$API_KEY"

# TODO: Move env.sh to build/electron/.
cat > build/env.nsh << EOF
!define RELEASE "$(scripts/semantic_version.sh -p windows)"
!define SENTRY_URL "${SENTRY_URL}"
EOF

# Publishing is disabled, updates are pulled from AWS. We use the generic provider instead of the S3
# provider since the S3 provider uses "virtual-hosted style" URLs (my-bucket.s3.amazonaws.com)
# which can be blocked by DNS or SNI without taking down other buckets.
electron-builder \
  --win \
  --publish never \
  --config src/electron/electron-builder.json \
  --config.extraMetadata.version=$(scripts/semantic_version.sh -p windows) \
  --config.win.certificateSubjectName='Jigsaw Operations LLC' \
  --config.generateUpdatesFilesForAllChannels=true \
  --config.publish.provider=generic \
  --config.publish.url=https://s3.amazonaws.com/outline-releases/client/windows

echo "stagingPercentage: $STAGING_PERCENTAGE" >> build/dist/$INFO_FILE_CHANNEL.yml
