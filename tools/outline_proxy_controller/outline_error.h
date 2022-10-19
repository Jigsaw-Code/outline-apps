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
//
// This file contains the C++11 standard conforming implementation of
// all errors used by outline.

#pragma once

#include <system_error>

namespace outline {

/**
 * @brief The standard error code constants used by outline.
 * @remarks The codes are copied from "/src/www/model/errors.ts".
 */
enum class outline_errc {
  ok = 0,
  unexpected = 1,
  vpn_permission_denied = 2,
  invalid_server_credentials = 3,
  udp_relay_not_enabled = 4,
  server_unreachable = 5,
  vpn_start_failure = 6,
  invalid_server_configuration = 7,
  shadowsocks_start_failure = 8,
  configure_system_proxy_failure = 9,
  admin_permission_denied = 10,
  unsupported_routing_table = 11,
  system_misconfigured = 12,
};

/**
 * @brief Get a singleton instance representing outline error category.
 * 
 * @return const std::error_category& The outline error category.
 */
const std::error_category& outline_category();

/**
 * @brief Construct an error_code from outline_error.
 * @remarks Can declare in the same namespace thanks to Koenig lookup.
 */
std::error_code make_error_code(outline::outline_errc);

}

namespace std {
/**
 * @brief Register to STL for implicit conversion to error_code.
 */
template<> struct is_error_code_enum<outline::outline_errc> : true_type {};
}
