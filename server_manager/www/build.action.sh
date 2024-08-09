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

readonly OUT_DIR="${BUILD_DIR}/server_manager/www"
rm -rf "${OUT_DIR}"

node infrastructure/build/run_action.mjs server_manager/www/build_install_script

# Node.js on Cygwin doesn't like absolute Unix-style paths.
# So, we use a relative path as input to webpack.
pushd "${ROOT_DIR}" > /dev/null
# Notice that we forward the build environment if defined.
webpack --config=server_manager/electron_renderer.webpack.js ${WEBPACK_MODE:+--mode=${WEBPACK_MODE}}
popd > /dev/null
