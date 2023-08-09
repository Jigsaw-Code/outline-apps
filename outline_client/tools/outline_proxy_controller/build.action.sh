#!/bin/bash

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

# Docker image with which to build the binary.
readonly DOCKER_IMAGE_NAME=outline_proxy_controller-build
docker build -t $DOCKER_IMAGE_NAME $(dirname $0)

# Work in a directory which Docker on OSX will by default make available to containers.
readonly TEMP=$(mktemp -d /tmp/temp.XXXX)
cp -Rv tools/outline_proxy_controller/* $TEMP/

# Build!
pushd $TEMP
docker run --rm -v $TEMP:$TEMP -w $TEMP/build $DOCKER_IMAGE_NAME sh -c 'cmake .. && make'
popd

# Copy the new binary into the repo.
cp $TEMP/build/OutlineProxyController tools/outline_proxy_controller/dist/
