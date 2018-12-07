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

SCRIPT_DIR=`dirname $0`

# Stop and delete the service.
systemctl stop outline_proxy_controller.service
mkdir -p /usr/local/etc/systemd/system || true
rm -f /usr/local/etc/systemd/system/OutlineProxyController || true

# Install and start the service, configuring it to restart on boot.
cp "$SCRIPT_DIR/OutlineProxyController" /usr/local/etc/systemd/system
cp "$SCRIPT_DIR/outline_proxy_controller.service" /etc/systemd/system/

systemctl daemon-reload
systemctl enable outline_proxy_controller.service
systemctl start outline_proxy_controller.service

# This is for the client: sudo-prompt discards stdout/stderr if the script
# exits with a non-zero return code *which will happen if any of the previous
# commands failed*.
exit 0
