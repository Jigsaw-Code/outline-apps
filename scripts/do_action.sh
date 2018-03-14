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

export ROOT_DIR=${ROOT_DIR:-$(git rev-parse --show-toplevel)}
export BUILD_DIR=${BUILD_DIR:-$ROOT_DIR/build}

function do_action() {
  local action=$1
  echo "[Running $action]"
  shift
  $ROOT_DIR/${action}_action.sh "$@"
  echo "[Done $action]"
}
export -f do_action

do_action "$@"
