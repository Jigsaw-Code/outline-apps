#!/bin/bash
#
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

set -eu

readonly OUT_DIR="${BUILD_DIR}/server_manager/www/sh/"
rm -rf "${OUT_DIR}"

# Create do_install_script.ts, which has a variable with the content of do_install_server.sh.
mkdir -p "${OUT_DIR}"

pushd "${ROOT_DIR}/server_manager/install_scripts" > /dev/null
tar --create --gzip -f "${OUT_DIR}/do_scripts.tgz" ./install_server.sh ./do_install_server.sh
tar --create --gzip -f "${OUT_DIR}/gcp_scripts.tgz" ./install_server.sh ./gcp_install_server.sh

# Node.js on Cygwin doesn't like absolute Unix-style paths.
# So, we use a relative path as input.
cd "${ROOT_DIR}"
node server_manager/install_scripts/build_do_install_script_ts.node.js \
    "${BUILD_DIR}/server_manager/www/sh/do_scripts.tgz" > "${ROOT_DIR}/server_manager/install_scripts/do_install_script.ts"
node server_manager/install_scripts/build_gcp_install_script_ts.node.js \
    "${BUILD_DIR}/server_manager/www/sh/gcp_scripts.tgz" > "${ROOT_DIR}/server_manager/install_scripts/gcp_install_script.ts"
popd > /dev/null
