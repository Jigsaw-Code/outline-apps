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

FROM ubuntu:22.04
RUN apt update && apt dist-upgrade -y
# Preempt interactive tzdata prompt
RUN DEBIAN_FRONTEND="noninteractive" TZ="America/New_York" apt-get -y install tzdata
RUN apt install -y build-essential gcc-11 g++-11 cmake wget

# Install boost 1.80 manually (apt install libboost-all-dev is 1.74 at the time of writing)
RUN wget https://boostorg.jfrog.io/artifactory/main/release/1.80.0/source/boost_1_80_0.tar.bz2 \
    && tar --bzip2 -xf ./boost_1_80_0.tar.bz2
RUN cd boost_1_80_0 \
    && ./bootstrap.sh \
    && ./b2 install
