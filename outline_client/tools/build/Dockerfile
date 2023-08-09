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

# Node.js and NPM.
RUN wget -qO- https://deb.nodesource.com/setup_10.x | bash -
RUN apt update && apt install -y nodejs && apt clean

# https://stackoverflow.com/questions/25672924/run-bower-from-root-user-its-possible-how
RUN echo '{"allow_root": true}' > /root/.bowerrc

# https://cordova.apache.org/docs/en/latest/reference/cordova-cli/#cordova-telemetry-command
ENV CI=true

COPY ./setup_linux_android.sh ./setup_linux_android.sh

RUN bash ./setup_linux_android.sh
