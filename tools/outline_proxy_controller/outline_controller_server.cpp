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

#include <memory>
#include <sstream>
#include <stdexcept>
#include <string>

#include <grp.h>
#include <unistd.h>
#include <pwd.h>

#include <boost/asio.hpp>
#include <boost/lexical_cast.hpp>
#include <boost/property_tree/json_parser.hpp>
#include <boost/property_tree/ptree.hpp>

#include "logger.h"
#include "outline_controller_server.h"
#include "outline_error.h"

using namespace outline;

//#region OutlineClientSession Implementation

// Routing commands from App
static const std::string kConfigureRoutingAction = "configureRouting";
static const std::string kResetRoutingAction = "resetRouting";
static const std::string kGetDeviceNameAction = "getDeviceName";

// Minimum length of JSON input from app
static const int kJsonInputMinLength = 10;

// The buffer size used to communicate with Outline client
static const int kChannelBufferSize = 1024;

/**
 * @brief Try to parse the raw input string as a Json object, and put the parsed object
 *        into `result`. The function returns `false` if `raw_str` is not valid.
 *
 * @param raw_str The input Json string to be parsed into a property tree.
 * @param result The result Boost property tree data structure.
 * @return true `raw_str` is a valid Json and `result` is the parsed property tree.
 * @return false `raw_str` is invalid and `result` is in an invalid state as well.
 */
static bool TryParseJson(const std::string &raw_str, boost::property_tree::ptree &result) {
  result.clear();
  try {
    std::istringstream input{raw_str};
    boost::property_tree::read_json(input, result);
    return true;
  } catch (const std::exception&) {
  }
  return false;
}

OutlineClientSession::OutlineClientSession(
  boost::asio::local::stream_protocol::socket &&channel,
  std::shared_ptr<OutlineProxyController> outline_proxy_controller)
  : channel_(std::move(channel)),
    outline_controller_(outline_proxy_controller)
{
  logger.info("client session started");
}

OutlineClientSession::~OutlineClientSession() {
  logger.info("client session terminated");
}

boost::asio::awaitable<void> OutlineClientSession::Start() {
  using namespace boost::asio;

  try {
    std::string client_command, raw_buffer;
    boost::property_tree::ptree request_obj;
    std::ostringstream response;
    for (;;) {
      do {
        co_await async_read_until(
          channel_, dynamic_buffer(raw_buffer, kChannelBufferSize), "}", use_awaitable);
        client_command.append(raw_buffer);
        raw_buffer.clear();
      } while (client_command.length() < kJsonInputMinLength || !TryParseJson(client_command, request_obj));

      logger.debug("handling client request \"" + client_command + "\"...");
      auto result = RunClientCommand(request_obj);

      // TODO: replace the following code with a json library to handle special characters
      response << "{\"statusCode\": " << result.status
               << ",\"returnValue\": \"" << result.result << "\""
               << ",\"action\": \"" << result.action << "\"}";
      co_await async_write(channel_, buffer(response.str()), use_awaitable);
      logger.debug("Wrote back \"" + response.str() + "\" to unix socket");

      client_command.clear();
      response.str(std::string{});
    }
  } catch (const std::exception& e) {
    channel_.close();
  }
}

OutlineClientSession::CommandResult OutlineClientSession::RunClientCommand(const boost::property_tree::ptree &request) {
  std::string action, outline_server_ip;

  auto action_iter = request.find("action");
  if (action_iter == request.not_found()) {
    logger.error("Invalid input JSON - action doesn't exist");
    return {static_cast<int>(ErrorCode::kUnexpected), "Invalid JSON", {}};
  }

  action = boost::lexical_cast<std::string>(request.to_iterator(action_iter)->second.data());
  logger.debug("handling action \"" + action + "\"");

  try {
    if (action == kConfigureRoutingAction) {
      auto parameters_iter = request.find("parameters");
      if (parameters_iter == request.not_found()) {
        logger.error("Invalid input JSON - parameters doesn't exist");
        return {static_cast<int>(ErrorCode::kUnexpected), "Invalid JSON", action};
      }
      const auto parameters = request.to_iterator(parameters_iter)->second;
      auto proxyIp_iter = parameters.find("proxyIp");
      if (proxyIp_iter == parameters.not_found()) {
        logger.error("Invalid input JSON - parameters doesn't exist");
        return {static_cast<int>(ErrorCode::kUnexpected), "Invalid JSON", action};
      }
      outline_server_ip =
          boost::lexical_cast<std::string>(request.to_iterator(proxyIp_iter)->second.data());
      outline_controller_->routeThroughOutline(outline_server_ip);
      logger.info("Configure Routing to " + outline_server_ip + " is done.");
      return {static_cast<int>(ErrorCode::kOk), {}, action};
    } else if (action == kResetRoutingAction) {
      outline_controller_->routeDirectly();
      logger.info("Reset Routing done");
      return {static_cast<int>(ErrorCode::kOk), {}, action};
    } else if (action == kGetDeviceNameAction) {
      logger.info("Get device name done");
      return {static_cast<int>(ErrorCode::kOk), outline_controller_->getTunDeviceName(), action};
    } else {
      logger.error("Invalid action specified in JSON (" + action + ")");
      return {static_cast<int>(ErrorCode::kUnexpected), "Undefined Action", {}};
    }
  } catch (const std::system_error& err) {
    logger.error("[" + err.code().message() + "] " + err.what());
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
      logger.info("updated unix socket owner to " +
        std::to_string(owner_uid) + "," + std::to_string(outline_group->gr_gid));
    } else {
      logger.warn("failed to update unix socket owner");
    }
  } else {
    logger.warn("failed to get the id of " + std::string{group_name} + " group");
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

      // The following lambda capturing client_session is necessary, otherwise client_session
      // will be deleted as soon as our local variable is out of scope (keep in mind that co_spawn
      // will run asynchronously).
      co_spawn(executor, [client_session]() { return client_session->Start(); }, detached);
    }
  }
}

//#endregion OutlineControllerServer Implementation
