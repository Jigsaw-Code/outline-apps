#include <cstdio>
#include <iostream>
#include <map>
#include <memory>
#include <stdexcept>
#include <string>

#include "outline_controller_server.h"

using namespace std;
using namespace outline;
using boost::asio::local::stream_protocol;

void session::start() {
  auto self(shared_from_this());
  boost::asio::spawn(strand_, [this, self](boost::asio::yield_context yield) {
    try {
      std::ostringstream response;
      std::string clientCommand, buffer;
      std::cout << "Client Connected" << std::endl;
      for (;;) {
        for (;;) {
          boost::asio::async_read_until(socket_, boost::asio::dynamic_buffer(buffer, 1024), "}",
                                        yield);
          std::cout << buffer << std::endl;
          clientCommand.append(buffer);
          buffer.clear();
          if (isValidJson(clientCommand)) {
            std::cout << "Valid JSON" << std::endl;
            break;
          }
        }
        auto rc = runClientCommand(clientCommand);
        response << "{\"statusCode\": " << std::get<0>(rc) << ",\"returnValue\": \""
                 << std::get<1>(rc) << "\""
                 << ",\"action\": \"" << std::get<2>(rc) << "\"}" << std::endl;
        boost::asio::async_write(
            socket_, boost::asio::buffer(response.str(), response.str().length()), yield);
        std::cout << "Wrote back (" << response.str() << ") to unix socket" << std::endl;
        clientCommand.clear();
        response.str(std::string());
      }
    } catch (std::exception& e) {
      socket_.close();
    }
  });
}

bool session::isValidJson(std::string str) {
  std::stringstream ss;
  boost::property_tree::ptree pt;

  if (str.length() >= JSON_INPUT_MIN_LENGTH) {
    ss << str;
    try {
      boost::property_tree::read_json(ss, pt);
      return true;
    } catch (std::exception const& e) {
    }
  }
  return false;
}

std::tuple<int, std::string, std::string> session::runClientCommand(std::string clientCommand) {
  std::stringstream ss;
  std::string action, outline_server_ip;
  boost::property_tree::ptree pt;

  // std::cout << clientCommand << std::endl;

  ss << clientCommand;

  try {
    boost::property_tree::read_json(ss, pt);
  } catch (std::exception const& e) {
    std::cerr << e.what() << std::endl;
    return std::make_tuple(GENERIC_FAILURE, "Invalid JSON", "");
  }

  boost::property_tree::ptree::assoc_iterator _action_iter = pt.find("action");
  if (_action_iter == pt.not_found()) {
    std::cerr << "Invalid input JSON - action doesn't exist" << std::endl;
    return std::make_tuple(GENERIC_FAILURE, "Invalid JSON", "");
  }
  action = boost::lexical_cast<std::string>(pt.to_iterator(_action_iter)->second.data());
  // std::cout << action << std::endl;

  if (action == CONFIGURE_ROUTING) {
    boost::property_tree::ptree::assoc_iterator _parameters_iter = pt.find("parameters");
    if (_parameters_iter == pt.not_found()) {
      std::cerr << "Invalid input JSON - parameters doesn't exist" << std::endl;
      return std::make_tuple(GENERIC_FAILURE, "Invalid JSON", action);
    }
    boost::property_tree::ptree parameters = pt.to_iterator(_parameters_iter)->second;
    boost::property_tree::ptree::assoc_iterator _proxyIp_iter = parameters.find("proxyIp");
    if (_proxyIp_iter == parameters.not_found()) {
      std::cerr << "Invalid input JSON - parameters doesn't exist" << std::endl;
      return std::make_tuple(GENERIC_FAILURE, "Invalid JSON", action);
    }
    outline_server_ip =
        boost::lexical_cast<std::string>(pt.to_iterator(_proxyIp_iter)->second.data());

    // std::cout << "action: [" << action << "]" << std::endl;
    // std::cout << "outline_server_ip: [" << outline_server_ip << "]" << std::endl;

    outlineProxyController_->routeThroughOutline(outline_server_ip);
    std::cout << "Configure Routing to " << outline_server_ip << " is done." << std::endl;
    return std::make_tuple(SUCCESS, "", action);

  } else if (action == RESET_ROUTING) {
    outlineProxyController_->routeDirectly();
    std::cout << "Reset Routing done" << std::endl;
    return std::make_tuple(SUCCESS, "", action);
  } else if (action == GET_DEVICE_NAME) {
    std::cout << "Reset Routing done" << std::endl;
    return std::make_tuple(SUCCESS, outlineProxyController_->getTunDeviceName(), action);
  } else {
    std::cerr << "Invalid action specified in JSON (" << action << ")" << std::endl;
  }

  return std::make_tuple(GENERIC_FAILURE, "Undefined Action", "");
}

OutlineControllerServer::OutlineControllerServer(boost::asio::io_context& io_context,
                                                 const std::string& file)
    : outlineProxyController_(std::make_shared<OutlineProxyController>()),
      unix_socket_name(file)

{
  ::unlink(unix_socket_name.c_str());
  boost::asio::spawn(io_context, [&](boost::asio::yield_context yield) {
    stream_protocol::acceptor acceptor(io_context, stream_protocol::endpoint(unix_socket_name));
    auto result =
        chmod(unix_socket_name.c_str(),
              S_IRWXU | S_IROTH | S_IWOTH);  // enables all user to read from and write into socket

    for (;;) {
      boost::system::error_code ec;
      stream_protocol::socket socket(io_context);
      acceptor.async_accept(socket, yield[ec]);
      if (!ec) std::make_shared<session>(std::move(socket), outlineProxyController_)->start();
    }
  });
}
