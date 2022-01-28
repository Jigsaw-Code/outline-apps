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

readonly ROOT_DIR="${ROOT_DIR:-$(git rev-parse --show-toplevel)}"
readonly BUILD_DIR="${BUILD_DIR:-$ROOT_DIR/build}"

export ROOT_DIR
export BUILD_DIR

export run_action_indent=''

function run_action() {
  local -r STYLE_BOLD_WHITE='\033[1;37m'
  local -r STYLE_BOLD_GREEN='\033[1;32m'
  local -r STYLE_BOLD_RED='\033[1;31m'
  local -r STYLE_RESET='\033[0m'

  local -r action="${1:-""}"
  local -r old_indent="${run_action_indent}"

  run_action_indent="=> ${run_action_indent}"

  if [[ -z "${action}" ]]; then
    echo -e "Please provide an action to run. ${STYLE_BOLD_WHITE}List of valid actions:${STYLE_RESET}\n"
    find . -name '*.action.sh' | sed -E 's:\./(.*)\.action\.sh:\1:'
    exit 0
  fi

  echo -e "${old_indent}${STYLE_BOLD_WHITE}[Running ${action}]${STYLE_RESET}"
  shift

  "${ROOT_DIR}/${action}.action.sh" "$@"

  local -ir status="$?"
  if (( status == 0 )); then
    echo -e "${old_indent}${STYLE_BOLD_GREEN}[${action}: Finished]${STYLE_RESET}"
  else
    echo -e "${old_indent}${STYLE_BOLD_RED}[${action}: Failed]${STYLE_RESET}"
  fi

  run_action_indent="${old_indent}"

  return "${status}"
}

export -f run_action

run_action "$@"
