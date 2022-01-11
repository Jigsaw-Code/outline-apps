#!/bin/bash -e

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

# Outputs a semantic version for the app, intended for the given platform and environment.

# In development, for the inputs 1.2.2 android development, the resulting tag would be 1.2.2+android.eg34og
# In prerelease, the resulting tag would be 1.2.2-rc0+android, where rc0 refers to 

function usage () {
  echo "$0 version platform environment" 1>&2
  echo "  version: the new version of the application" 1>&2
  echo "  platform: (android, ios, osx, browser, windows, linux, or dev)" 1>&2
  echo "  environment: the environment you're deploying to (development, prerelease, production)" 1>&2
  echo 1>&2
  echo "Examples:" 1>&2
  echo "  $0 1.2.2 android development" 1>&2
  exit 1
}

SEMVER_VERSION=$1
PLATFORM=$2
ENVIRONMENT=$3

[[ ! $SEMVER_VERSION || ! $PLATFORM || ! $ENVIRONMENT ]] && usage
[[ "${SEMVER_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 2

SEMVER_METADATA=
SEMVER_PRERELEASE=

if [[ "${ENVIRONMENT}" == "development" ]]; then
  SEMVER_METADATA="+${PLATFORM}.$(git log --pretty=format:'%h' -n 1)"
elif [[ "${ENVIRONMENT}" == "prerelease" ]]; then
  SEMVER_METADATA="+${PLATFORM}"
  SEMVER_PRERELEASE="-rc$(git tag -l "${SEMVER_VERSION}-rc*${SEMVER_METADATA}" | wc -l | xargs)"
fi

echo "${SEMVER_VERSION}${SEMVER_PRERELEASE}${SEMVER_METADATA}"
