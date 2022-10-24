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

namespace impl {

/**
 * @brief The error category representing all error codes used by outline.
 */
class OutlineErrorCategory : public std::error_category {
public:
  virtual const char *name() const noexcept override {
    return "outline";
  }

  virtual std::string message(int ev) const override {
    switch (ev) {
      case static_cast<int>(ErrorCode::kOk):
        return "ok";
      case static_cast<int>(ErrorCode::kUnexpected):
        return "unexpected";
      case static_cast<int>(ErrorCode::kVpnPermissionDenied):
        return "vpn permission denied";
      case static_cast<int>(ErrorCode::kInvalidServerCredentials):
        return "invalid server credentials";
      case static_cast<int>(ErrorCode::kUdpRelayNotEnabled):
        return "udp relay not enabled";
      case static_cast<int>(ErrorCode::kServerUnreachable):
        return "server unreachable";
      case static_cast<int>(ErrorCode::kVpnStartFailure):
        return "vpn start failure";
      case static_cast<int>(ErrorCode::kInvalidServerConfiguration):
        return "invalid server configuration";
      case static_cast<int>(ErrorCode::kShadowsocksStartFailure):
        return "shadowsocks start failure";
      case static_cast<int>(ErrorCode::kConfigureSystemProxyFailure):
        return "configure system proxy failure";
      case static_cast<int>(ErrorCode::kAdminPermissionDenied):
        return "admin permission denied";
      case static_cast<int>(ErrorCode::kUnsupportedRoutingTable):
        return "unsupported routing table";
      case static_cast<int>(ErrorCode::kSystemMisconfigured):
        return "system misconfigured";
      default:
        return "(unrecognized error)";
    }
  }
};

}

const std::error_category& OutlineErrorCategory() {
  static impl::OutlineErrorCategory instance;
  return instance;
}

std::error_code make_error_code(ErrorCode err) {
  return {static_cast<int>(err), OutlineErrorCategory()};
}

}
