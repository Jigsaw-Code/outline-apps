#!/bin/bash -eu

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

TYPE=dev
PLATFORM=

# TODO: Remove -p dev once the Electron clients can function without an environment.json file (see
#       src/electron/build_action.sh for more info).

function usage () {
  echo "$0 [-r] [-h]" 1>&2
  echo "  -r: use prod Sentry keys" 1>&2
  echo "  -p: platform (android, ios, osx, browser, windows, linux, or dev)" 1>&2
  echo "  -h: this help message" 1>&2
  echo 1>&2
  echo "Examples:" 1>&2
  echo "  $0 -p android -r" 1>&2
  exit 1
}

while getopts rp:h? opt; do
  case $opt in
    r) TYPE=release ;;
    p) PLATFORM=$OPTARG ;;
    h) usage ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

if [[ "${TYPE}" == "release" && -z ${SENTRY_DSN:-} ]]; then
  echo "SENTRY_DSN is undefined." 1>&2
  exit 1
fi

APP_VERSION="$(node "$(dirname "$0")/get_version.mjs" -p "$PLATFORM")"
APP_BUILD_NUMBER="$(node "$(dirname "$0")/get_build_number.mjs" -p "$PLATFORM")"

cat << EOM
{
  "APP_VERSION": "$APP_VERSION",
  "APP_BUILD_NUMBER": "$APP_BUILD_NUMBER",
  "SENTRY_DSN": "${SENTRY_DSN:-}"
}
EOM
