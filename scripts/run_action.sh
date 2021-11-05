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

export ROOT_DIR="${ROOT_DIR:-$(git rev-parse --show-toplevel)}"
export BUILD_DIR="${BUILD_DIR:-$ROOT_DIR/build}"
export RUN_ACTION_INDENT=''

function run_action() {
  local -r ACTION="${1:-""}"
  local -r STYLE_BOLD_WHITE='\033[1;37m'
  local -r STYLE_BOLD_GREEN='\033[1;32m'
  local -r STYLE_BOLD_RED='\033[1;31m'
  local -r STYLE_RESET='\033[0m'
  local -r OLD_INDENT="${RUN_ACTION_INDENT}"

  RUN_ACTION_INDENT="=> ${RUN_ACTION_INDENT}"

  if [[ "${ACTION}" == "" ]]; then
    echo -e "Please provide an action to run. ${STYLE_BOLD_WHITE}List of valid actions:${STYLE_RESET}\n"
    find . -name '*.action.sh' | sed -E 's:./(.*).action.sh:\1:'
    exit 0
  fi

  echo -e "${OLD_INDENT}${STYLE_BOLD_WHITE}[Running ${ACTION}]${STYLE_RESET}"
  shift

  "${ROOT_DIR}/${ACTION}.action.sh" "$@"

  local -ir STATUS="$?"
  if [[ "${STATUS}" == "0" ]]; then
    echo -e "${OLD_INDENT}${STYLE_BOLD_GREEN}[${ACTION}: Finished]${STYLE_RESET}"
  else
    echo -e "${OLD_INDENT}${STYLE_BOLD_RED}[${ACTION}: Failed]${STYLE_RESET}"
  fi

  RUN_ACTION_INDENT="${OLD_INDENT}"

  return "${STATUS}"
}

export -f run_action

run_action "$@"
