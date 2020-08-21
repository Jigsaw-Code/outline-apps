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

# Outputs a semantic version for the app, intended for use by the Electron clients.
#
# The script looks in a few places for the version, in this order:
#  - The TRAVIS_TAG environment variable trumps all: if present, the version contained here will be
#    used. It may be a "release" build, e.g. the semantic version for the release tagged
#    "linux-v1.0.0" is 1.0.0, or a pre-release build, e.g. the semantic version for the release
#    tagged "daily-2018-12-01" is "0.0.0-daily-2018-12-01".
#  - As an alternative to TRAVIS_TAG, tags associated with the current git will be searched. This is
#    primarily intended for Windows release builds, which cannot be performed on Travis. For this to
#    work, you must specify the -p switch which helps disambiguate commits with multiple release
#    tags.
#  - If the previous two searches fail, the short-form SHA of the current commit will be appended to
#    the version 0.0.0, e.g. 0.0.0+a78f88.

PLATFORM=

function usage () {
  echo "$0 [-p platform] [-h]"
  echo "  -p: platform"
  echo "  -h: this help message"
  echo
  echo "Examples:"
  echo "  $0 -p linux"
  exit 1
}

while getopts p:h? opt; do
  case $opt in
    p) PLATFORM=$OPTARG ;;
    h) usage ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

# Search for a tag in the Travis environment and the current commit's tags.
if ! TAG=$($(dirname $0)/get_tag.sh $PLATFORM); then
  echo "Cannot compute semantic version" >&2
  exit 2
fi

# Search for a semantic version in the tag, e.g. windows-v1.0.1 -> 1.0.1.
if echo "$TAG" | grep -q '.*-v'; then
  SEMVER=$(echo "$TAG" | sed 's/[^-]*-v//')
fi

if [[ -n "$SEMVER" ]]; then
  # Production build.
  echo "$SEMVER"
elif [[ -n "$TAG" ]]; then
  # Pre-release, e.g. daily build:
  #   https://semver.org/#spec-item-9
  echo "0.0.0-$TAG"
else
  # Local, ad-hoc run or build: just append the SHA of the current commit:
  #   https://semver.org/#spec-item-10
  echo "0.0.0+$(git log --pretty=format:'%h' -n 1)"
fi
