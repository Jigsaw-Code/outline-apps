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
set -eu

BUILD=false
PUBLISH=false
IMAGE_NAME="cordova_android_container"

function error() {
  echo "$@" >&2
}

function usage() {
  cat <<-EOM
Usage: $0 commands

Examples:
  $0 npm run clean
  $0 npm ci
  $0 build
EOM
exit 1
}

while getopts h? opt; do
  case $opt in
    *) usage ;;
  esac
done
shift $((OPTIND-1))

if ! which docker > /dev/null; then
  error "You must install docker first. See https://docs.docker.com/engine/installation/"
  exit 1
fi

if (( $# > 0 )); then
  # build the container
  docker build -t "${IMAGE_NAME}" src/cordova/android/container

  # Rather than a working directory of something like "/worker", mirror
  # the path on the host so that symlink tricks work as expected.
  readonly GIT_ROOT=$(git rev-parse --show-toplevel)
  docker run --rm -v "${GIT_ROOT}":"${GIT_ROOT}" -w "${GIT_ROOT}" -e SENTRY_DSN=${SENTRY_DSN:-} "${IMAGE_NAME}" npm run action "$@"

  # GNU stat uses -c for format, which BSD stat does not accept; it uses -f instead
  stat -c 2>&1 | grep -q illegal && STATFLAG="f" || STATFLAG="c"

  # TODO: Don't spin up a second container just to chown.
  docker run --rm -v "${GIT_ROOT}":/worker -w /worker "${IMAGE_NAME}" chown -R $(stat -$STATFLAG "%u:%g" .git) /worker
fi
