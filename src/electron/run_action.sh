#!/bin/bash -eux
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

yarn do src/electron/build


package_tail="$(tail -n +2 package.json)"
cat > package.json <<EOM
{
  "version": "${APP_VERSION:-0.1.0}",
${package_tail}
EOM

trap cleanup_package_json INT
cleanup_package_json() {
    sed -i '/"version"/d' package.json
}

export OUTLINE_DEBUG=true
electron .

# Runs if the app was closed with the Quit button instead
# of SIGINT
cleanup_package_json
