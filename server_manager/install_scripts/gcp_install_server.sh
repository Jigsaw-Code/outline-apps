#!/bin/bash
#
# Copyright 2021 The Outline Authors
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

# Script to install Shadowbox on a GCP Compute Engine instance

# You may set the following environment variables, overriding their defaults:
# SB_IMAGE: Shadowbox Docker image to install, e.g. quay.io/outline/shadowbox:nightly
# SB_API_PORT: The port number of the management API.
# SENTRY_API_URL: Url to post Sentry report to on error.
# WATCHTOWER_REFRESH_SECONDS: refresh interval in seconds to check for updates,
#     defaults to 3600.

set -euo pipefail

export SHADOWBOX_DIR="${SHADOWBOX_DIR:-${HOME:-/root}/shadowbox}"
mkdir -p "${SHADOWBOX_DIR}"

# Save output for debugging
exec &> "${SHADOWBOX_DIR}/install-shadowbox-output"

function cloud::public_ip() {
  curl curl -H "Metadata-Flavor: Google" "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip"
}

# Initialize sentry log file.
export SENTRY_LOG_FILE="${SHADOWBOX_DIR}/sentry-log-file.txt"
true > "${SENTRY_LOG_FILE}"
function log_for_sentry() {
  echo "[$(date "+%Y-%m-%d@%H:%M:%S")]" "gcp_install_server.sh" "$@" >> "${SENTRY_LOG_FILE}"
}

function post_sentry_report() {
  if [[ -n "${SENTRY_API_URL}" ]]; then
    # Get JSON formatted string.  This command replaces newlines with literal '\n'
    # but otherwise assumes that there are no other characters to escape for JSON.
    # If we need better escaping, we can install the jq command line tool.
    local -ir SENTRY_PAYLOAD_BYTE_LIMIT=8000
    local SENTRY_PAYLOAD
    SENTRY_PAYLOAD="{\"message\": \"Install error:\n$(awk '{printf "%s\\n", $0}' < "${SENTRY_LOG_FILE}" | tail --bytes "${SENTRY_PAYLOAD_BYTE_LIMIT}")\"}"
    # See Sentry documentation at:
    # https://media.readthedocs.org/pdf/sentry/7.1.0/sentry.pdf
    curl "${SENTRY_API_URL}" -H "Origin: shadowbox" --data-binary "${SENTRY_PAYLOAD}"
  fi
}

# Applies a guest attribute to the GCE VM.
function cloud::set_guest_attribute() {
  local label_key="$1"
  local label_value="$2"

  local GUEST_ATTIBUTE_NAMESPACE="outline"
  local SET_GUEST_ATTRIBUTE_URL="http://metadata.google.internal/computeMetadata/v1/instance/guest-attributes/${GUEST_ATTIBUTE_NAMESPACE}/${label_key}"
  curl -H "Metadata-Flavor: Google" -X PUT -d "${label_value}" "${SET_GUEST_ATTRIBUTE_URL}"
}

cloud::set_guest_attribute "install-started" "true"

# Enable BBR.
# Recent DigitalOcean one-click images are based on Ubuntu 18 and have kernel 4.15+.
log_for_sentry "Enabling BBR"
cat >> /etc/sysctl.conf << EOF

# Added by Outline.
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
EOF
sysctl -p

log_for_sentry "Initializing ACCESS_CONFIG"
export ACCESS_CONFIG="${SHADOWBOX_DIR}/access.txt"
true > "${ACCESS_CONFIG}"

# Set trap which publishes an error tag and sentry report only if there is an error.
function finish {
    INSTALL_SERVER_EXIT_CODE=$?
    log_for_sentry "In EXIT trap, exit code ${INSTALL_SERVER_EXIT_CODE}"
    if ! ( grep --quiet apiUrl "${ACCESS_CONFIG}" && grep --quiet certSha256 "${ACCESS_CONFIG}" ); then
      echo "INSTALL_SCRIPT_FAILED: ${INSTALL_SERVER_EXIT_CODE}" | cloud::set_guest_attribute "install-error" "true"
      # Post error report to sentry.
      post_sentry_report
    fi
}
trap finish EXIT

# Docker is not installed by default.  If we don't install it here,
# install.sh will download it using the get.docker.com script (much slower).
log_for_sentry "Downloading Docker"
# Following instructions from https://docs.docker.com/engine/install/ubuntu/#install-from-a-package

declare -ar PACKAGES=(
  'containerd.io_1.4.9-1_amd64.deb'
  'docker-ce_20.10.8~3-0~ubuntu-focal_amd64.deb'
  'docker-ce-cli_20.10.8~3-0~ubuntu-focal_amd64.deb'
)

declare packages_csv
packages_csv="$(printf ',%s' "${PACKAGES[@]}")"
packages_csv="${packages_csv:1}"
curl --remote-name-all --fail "https://download.docker.com/linux/ubuntu/dists/focal/pool/stable/amd64/{${packages_csv}}"
log_for_sentry "Installing Docker"
dpkg --install "${PACKAGES[@]}"
rm "${PACKAGES[@]}"

# Run install script asynchronously, so tags can be written as soon as they are ready.
log_for_sentry "Running install_server.sh"
./install_server.sh&
declare -ir install_pid=$!

# Save tags for access information.
log_for_sentry "Reading tags from ACCESS_CONFIG"
tail -f "${ACCESS_CONFIG}" "--pid=${install_pid}" | while IFS=: read -r key value; do
  case "${key}" in
    certSha256)
      log_for_sentry "Writing certSha256 tag"
      echo "case certSha256: ${key}/${value}"
      # The value is hex(fingerprint) and Electron expects base64(fingerprint).
      hex_fingerprint="${value}"
      base64_fingerprint="$(echo -n "${hex_fingerprint}" | xxd -revert -p -c 255 | base64)"
      cloud::set_guest_attribute "${key}" "${base64_fingerprint}"
      ;;
    apiUrl)
      log_for_sentry "Writing apiUrl tag"
      echo "case apiUrl: ${key}/${value}"
      url_value=$(echo -n "${value}")
      cloud::set_guest_attribute "${key}" "${url_value}"
      ;;
  esac
done

# Wait for install script to finish, so that if there is any error in install_server.sh,
# the finish trap in this file will be able to access its error code.
wait "${install_pid}"
