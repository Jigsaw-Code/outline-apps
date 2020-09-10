# Copyright 2019 The Outline Authors
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

# Though we normally prefer Alpine, many of the Android build tools require glibc.
FROM debian:9

# Notes on dependencies:
#  - Bower requires git
#  - gnupg is needed by the Node.js installer to add an Apt repository.
#  - Several of Outline's build scripts require rsync.
RUN apt update && apt dist-upgrade -y && apt install -y wget unzip openjdk-8-jdk-headless gradle git gnupg rsync && apt clean

# Node.js and Yarn.
RUN wget -qO- https://deb.nodesource.com/setup_10.x | bash -
RUN wget -qO- https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt update && apt install -y nodejs yarn && apt clean

# https://stackoverflow.com/questions/25672924/run-bower-from-root-user-its-possible-how
RUN echo '{"allow_root": true}' > /root/.bowerrc

# https://cordova.apache.org/docs/en/latest/reference/cordova-cli/#cordova-telemetry-command
ENV CI=true

# Since the command-line Android development tools are poorly
# documented, these steps are cobbled together from lots of
# trial and error, old pinball machine parts, and various
# Dockerfiles lying around Github. Bitrise, in particular,
# maintains images with many useful hints:
#   https://github.com/bitrise-docker/android

# Download Android Command Line Tools:
#   https://developer.android.com/studio/command-line
# This is version 2.1.
ENV ANDROID_SDK_ROOT /opt/android-sdk
RUN cd /opt \
    && wget -q https://dl.google.com/android/repository/commandlinetools-linux-6609375_latest.zip -O android-commandline-tools.zip \
    && mkdir -p ${ANDROID_SDK_ROOT}/cmdline-tools \
    && unzip -q android-commandline-tools.zip -d ${ANDROID_SDK_ROOT}/cmdline-tools \
    && rm android-commandline-tools.zip

ENV PATH ${PATH}:${ANDROID_SDK_ROOT}/platform-tools:${ANDROID_SDK_ROOT}/cmdline-tools/tools/bin

# Android SDK Build Tools:
#   https://developer.android.com/studio/releases/build-tools.html
# To find the latest version's label:
#   sdkmanager --list|grep build-tools
ENV ANDROID_BUILD_TOOLS_VERSION 30.0.2
RUN yes | sdkmanager "build-tools;${ANDROID_BUILD_TOOLS_VERSION}"
