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

readonly PREFIX=/usr/local
readonly SERVICE_DIR=/etc/systemd/system
readonly SERVICE_NAME=outline_proxy_controller.service
readonly GROUP_NAME=outlinevpn
readonly SCRIPT_DIR="$(dirname ${0})"

# Create outlinevpn group
/usr/sbin/groupadd -f "${GROUP_NAME}"
if /usr/bin/id "${1}" &>/dev/null; then
  /usr/sbin/usermod -aG "${GROUP_NAME}" "${1}"
  /usr/bin/echo "user ${1} has been added to ${GROUP_NAME} group"
else
  /usr/bin/echo "warn: no user will be added to ${GROUP_NAME} group" >&2
fi

# Copy/update the service's files.
/usr/bin/cp -f "${SCRIPT_DIR}/OutlineProxyController" "${PREFIX}/sbin"
/usr/bin/cp -f "${SCRIPT_DIR}/${SERVICE_NAME}" "${SERVICE_DIR}/"

# Replace "--owning-user-id" argument in ".service" file with the actual user
if /usr/bin/id "${1}" &>/dev/null; then
  owneruid="$(id -u "${1}")"
  /usr/bin/sed -i "s/--owning-user-id=-1/--owning-user-id=${owneruid}/g" "${SERVICE_DIR}/${SERVICE_NAME}"
fi

# (Re-)start the service.
/usr/bin/systemctl daemon-reload
/usr/bin/systemctl enable "${SERVICE_NAME}"
/usr/bin/systemctl restart "${SERVICE_NAME}"

# Because the .service file specifies Type=simple, the installation script exits immediately.
# Sleep for a couple of seconds before exiting.
/usr/bin/sleep 2
