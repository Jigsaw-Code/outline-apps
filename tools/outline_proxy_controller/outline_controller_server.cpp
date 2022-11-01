// Copyright 2018 The Outline Authors
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

#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>

#include <grp.h>
#include <unistd.h>
#include <pwd.h>

#include <boost/asio.hpp>
#include <boost/lexical_cast.hpp>
#include <boost/property_tree/json_parser.hpp>
#include <boost/property_tree/ptree.hpp>

#include "outline_controller_server.h"
#include "outline_error.h"

using namespace outline;

//#region OutlineClientSession Implementation

// Minimum length of JSON input from app
static const int kJsonInputMinLength = 10;

// The buffer size used to communicate with Outline client
static const int kChannelBufferSize = 1024;

/**
 * @brief Checks the input string and returns true if it's a valid json.
 */
static bool IsValidJson(const std::string &input) {
  if (input.length() >= kJsonInputMinLength) {
    try {
      boost::property_tree::ptree pt;
      boost::property_tree::read_json(input, pt);
      std::cout << "Valid JSON" << std::endl;
      return true;
    } catch (std::exception const& e) {
    }
  }
  return false;
}

OutlineClientSession::OutlineClientSession(
  boost::asio::local::stream_protocol::socket channel,
  std::shared_ptr<OutlineProxyController> outline_proxy_controller)
  : channel_(std::move(channel)),
    outline_controller_(outline_proxy_controller)
{}

boost::asio::awaitable<void> OutlineClientSession::Start() {
  using namespace boost::asio;

  std::cout << "Client Connected" << std::endl;
  try {
    std::string client_command, raw_buffer;
    std::ostringstream response;
    for (;;) {
      do {
        co_await async_read_until(
          channel_, dynamic_buffer(raw_buffer, kChannelBufferSize), "}", use_awaitable);
        std::cout << raw_buffer << std::endl;
        client_command.append(raw_buffer);
        raw_buffer.clear();
      } while (!IsValidJson(client_command));

      auto result = RunClientCommand(client_command);
      // TODO: replace the following code with a json library to handle special characters
      response << "{\"statusCode\": " << result.status
               << ",\"returnValue\": \"" << result.result << "\""
               << ",\"action\": \"" << result.action << "\"}";

      co_await async_write(channel_, buffer(response.str()), use_awaitable);
      std::cout << "Wrote back \"" << response.str() << "\" to unix socket" << std::endl;
      client_command.clear();
      response.str(std::string{});
    }
  } catch (const std::exception& e) {
    channel_.close();
  }
}

OutlineClientSession::CommandResult OutlineClientSession::RunClientCommand(const std::string &command) {
  std::cout << command << std::endl;

  std::stringstream ss;
  ss << command;

  std::string action, outline_server_ip;
  boost::property_tree::ptree pt;

  try {
    boost::property_tree::read_json(ss, pt);
  } catch (std::exception const& e) {
    std::cerr << e.what() << std::endl;
    return {static_cast<int>(ErrorCode::kUnexpected), "Invalid JSON", {}};
  }

  boost::property_tree::ptree::assoc_iterator _action_iter = pt.find("action");
  if (_action_iter == pt.not_found()) {
    std::cerr << "Invalid input JSON - action doesn't exist" << std::endl;
    return {static_cast<int>(ErrorCode::kUnexpected), "Invalid JSON", {}};
  }
  action = boost::lexical_cast<std::string>(pt.to_iterator(_action_iter)->second.data());
  // std::cout << action << std::endl;

  try {
    if (action == CONFIGURE_ROUTING) {
      boost::property_tree::ptree::assoc_iterator _parameters_iter = pt.find("parameters");
      if (_parameters_iter == pt.not_found()) {
        std::cerr << "Invalid input JSON - parameters doesn't exist" << std::endl;
        return {static_cast<int>(ErrorCode::kUnexpected), "Invalid JSON", action};
      }
      boost::property_tree::ptree parameters = pt.to_iterator(_parameters_iter)->second;
      boost::property_tree::ptree::assoc_iterator _proxyIp_iter = parameters.find("proxyIp");
      if (_proxyIp_iter == parameters.not_found()) {
        std::cerr << "Invalid input JSON - parameters doesn't exist" << std::endl;
        return {static_cast<int>(ErrorCode::kUnexpected), "Invalid JSON", action};
      }
      outline_server_ip =
          boost::lexical_cast<std::string>(pt.to_iterator(_proxyIp_iter)->second.data());

      outline_controller_->routeThroughOutline(outline_server_ip);
      std::cout << "Configure Routing to " << outline_server_ip << " is done." << std::endl;
      return {static_cast<int>(ErrorCode::kOk), {}, action};
    } else if (action == RESET_ROUTING) {
      outline_controller_->routeDirectly();
      std::cout << "Reset Routing done" << std::endl;
      return {static_cast<int>(ErrorCode::kOk), {}, action};
    } else if (action == GET_DEVICE_NAME) {
      std::cout << "Get device name done" << std::endl;
      return {static_cast<int>(ErrorCode::kOk), outline_controller_->getTunDeviceName(), action};
    } else {
      std::cerr << "Invalid action specified in JSON (" << action << ")" << std::endl;
      return {static_cast<int>(ErrorCode::kUnexpected), "Undefined Action", {}};
    }
  } catch (const std::system_error& err) {
    std::cerr << "[" << err.code() << "] " << err.what() << std::endl;
    if (err.code().category() == OutlineErrorCategory()) {
      // TODO: add err.what() to give more details to the client
      return {err.code().value(), {}, action};
    }
    return {static_cast<int>(ErrorCode::kUnexpected), {}, action};
  }
}

//#endregion OutlineClientSession Implementation

//#region OutlineControllerServer Implementation

// Owning group name of the Outline Proxy Controller Unix socket
static const char* const kOutlineGroupName = "outlinevpn";

static void SetOutlineUnixSocketGroupAndOwner(const char* const socket_name,
                                              const char* const group_name,
                                              uid_t owning_user) {
  auto outline_group = ::getgrnam(group_name);
  if (outline_group != nullptr) {
    auto owner_uid = ::getpwuid(owning_user) != nullptr ? owning_user : -1;
    if (::chown(socket_name, owner_uid, outline_group->gr_gid) == 0) {
      std::cout << "updated unix socket owner to " << owner_uid << "," << outline_group->gr_gid << std::endl;
    } else {
      std::cerr << "failed to update unix socket owner" << std::endl;
    }
  } else {
    std::cerr << "failed to get the id of " << group_name << " group" << std::endl;
  }
  ::chmod(socket_name, S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP);
}

OutlineControllerServer::OutlineControllerServer(const std::string& file, uid_t owning_user)
  : outline_controller_{std::make_shared<OutlineProxyController>()},
    unix_socket_name_{file},
    socket_owner_id_{owning_user}
{}

boost::asio::awaitable<void> OutlineControllerServer::Start() {
  using namespace boost::asio;
  using local::stream_protocol;

  auto executor = co_await this_coro::executor;

  ::unlink(unix_socket_name_.c_str());
  stream_protocol::acceptor acceptor{executor, {unix_socket_name_}};
  SetOutlineUnixSocketGroupAndOwner(unix_socket_name_.c_str(), kOutlineGroupName, socket_owner_id_);

  for (;;) {
    stream_protocol::socket socket{executor};
    if (auto [err] = co_await acceptor.async_accept(socket, as_tuple(use_awaitable)); !err) {
      auto client_session = std::make_shared<OutlineClientSession>(std::move(socket), outline_controller_);
      co_spawn(executor, client_session->Start(), detached);
    }
  }
}

//#endregion OutlineControllerServer Implementation
