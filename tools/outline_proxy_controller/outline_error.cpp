// Copyright 2022 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include <string>
#include "outline_error.h"

namespace outline {

/**
 * @brief The error category representing all error codes used by outline.
 */
class outline_error_category : public std::error_category {
public:
  virtual const char *name() const noexcept override;
  virtual std::string message(int) const override;
};

const std::error_category& outline_category() {
  static outline_error_category singleton;
  return singleton;
}

std::error_code make_error_code(outline_errc err) {
  return {static_cast<int>(err), outline_category()};
}

const char *outline_error_category::name() const noexcept {
  return "outline";
}

std::string outline_error_category::message(int ev) const {
  switch (ev) {
    case static_cast<int>(outline_errc::ok):
      return "ok";
    case static_cast<int>(outline_errc::unexpected):
      return "unexpected";
    case static_cast<int>(outline_errc::vpn_permission_denied):
      return "vpn permission denied";
    case static_cast<int>(outline_errc::invalid_server_credentials):
      return "invalid server credentials";
    case static_cast<int>(outline_errc::udp_relay_not_enabled):
      return "udp relay not enabled";
    case static_cast<int>(outline_errc::server_unreachable):
      return "server unreachable";
    case static_cast<int>(outline_errc::vpn_start_failure):
      return "vpn start failure";
    case static_cast<int>(outline_errc::invalid_server_configuration):
      return "invalid server configuration";
    case static_cast<int>(outline_errc::shadowsocks_start_failure):
      return "shadowsocks start failure";
    case static_cast<int>(outline_errc::configure_system_proxy_failure):
      return "configure system proxy failure";
    case static_cast<int>(outline_errc::admin_permission_denied):
      return "admin permission denied";
    case static_cast<int>(outline_errc::unsupported_routing_table):
      return "unsupported routing table";
    case static_cast<int>(outline_errc::system_misconfigured):
      return "system misconfigured";
    default:
      return "(unrecognized error)";
  }
}

}
