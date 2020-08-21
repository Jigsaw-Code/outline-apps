#!/bin/bash -e

# Copyright 2020 The Outline Authors
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

# Searches for a tag in the environment or the current git branch

PLATFORM=$1
TAG=
if [[ -n $TRAVIS_TAG ]]; then
  TAG=$TRAVIS_TAG
elif [[ "$PLATFORM" != "dev" ]]; then
  TAG=$(git tag --points-at | grep ^$PLATFORM- | sort | tail -1)
  if [[ -z "$TAG" ]]; then
    echo "No tag found for $PLATFORM" >&2
    exit 1
  fi
fi

echo $TAG
