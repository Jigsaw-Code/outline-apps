#include <array>
#include <cstdio>
#include <iostream>
#include <memory>
#include <stdexcept>

#include <sys/stat.h>
#include <sys/types.h>

#include <boost/algorithm/string.hpp>
#include <boost/asio.hpp>
#include <boost/asio/spawn.hpp>
#include <boost/lexical_cast.hpp>
#include <boost/property_tree/json_parser.hpp>
#include <boost/property_tree/ptree.hpp>

#include "outline_proxy_controller.h"

#if defined(BOOST_ASIO_HAS_LOCAL_SOCKETS)

using boost::asio::local::stream_protocol;
using namespace std;

namespace outline {

// Routing commands from App
const std::string CONFIGURE_ROUTING = "configureRouting";
const std::string RESET_ROUTING = "resetRouting";

// Error codes to communicate back to the app
const int SUCCESS = 0;
const int GENERIC_FAILURE = 1;
const int UNSUPPORTED_ROUTING_TABLE = 2;

// Minimum length of JSON input from app
const int JSON_INPUT_MIN_LENGTH = 10;

class session : public std::enable_shared_from_this<session> {
 public:
  session(stream_protocol::socket sock,
          std::shared_ptr<OutlineProxyController> outlineProxyController)
      : socket_(std::move(sock)),
        strand_(socket_.get_io_context()),
        outlineProxyController_(outlineProxyController) {}

  void start() {
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
          int rc = runClientCommandJson(clientCommand);
          response << "{\"statusCode\": " << rc << "}" << std::endl;
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

 private:
  /**
   * Checks the input string and returns true if it's a valid json
   */
  bool isValidJson(std::string str) {
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

  void runClientCommand(std::string clientCommand) {
    std::vector<std::string> command_parts;
    boost::split(command_parts, clientCommand, [](char c) { return c == ' '; });

    if (command_parts[0] == "connect") {
      if (command_parts.size() < 2)
        throw runtime_error("command connect is called with less than 2 arguments");

      std::string outline_server_ip = command_parts[1];
      outlineProxyController_->routeThroughOutline(outline_server_ip);

    } else if (command_parts[0] == "disconnect") {
      outlineProxyController_->routeDirectly();
    }
  }

  /**
   * Parses input JSON from the app
   */
  int runClientCommandJson(std::string clientCommand) {
    std::stringstream ss;
    std::string action, outline_server_ip;
    boost::property_tree::ptree pt;

    // std::cout << clientCommand << std::endl;

    ss << clientCommand;

    try {
      boost::property_tree::read_json(ss, pt);
    } catch (std::exception const& e) {
      std::cerr << e.what() << std::endl;
      return GENERIC_FAILURE;
    }

    boost::property_tree::ptree::assoc_iterator _action_iter = pt.find("action");
    if (_action_iter == pt.not_found()) {
      std::cerr << "Invalid input JSON - action doesn't exist" << std::endl;
      return GENERIC_FAILURE;
    }
    action = boost::lexical_cast<std::string>(pt.to_iterator(_action_iter)->second.data());
    // std::cout << action << std::endl;

    if (action == CONFIGURE_ROUTING) {
      boost::property_tree::ptree::assoc_iterator _parameters_iter = pt.find("parameters");
      if (_parameters_iter == pt.not_found()) {
        std::cerr << "Invalid input JSON - parameters doesn't exist" << std::endl;
        return GENERIC_FAILURE;
      }
      boost::property_tree::ptree parameters = pt.to_iterator(_parameters_iter)->second;
      boost::property_tree::ptree::assoc_iterator _proxyIp_iter = parameters.find("proxyIp");
      if (_proxyIp_iter == parameters.not_found()) {
        std::cerr << "Invalid input JSON - parameters doesn't exist" << std::endl;
        return GENERIC_FAILURE;
      }
      outline_server_ip =
          boost::lexical_cast<std::string>(pt.to_iterator(_proxyIp_iter)->second.data());

      // std::cout << "action: [" << action << "]" << std::endl;
      // std::cout << "outline_server_ip: [" << outline_server_ip << "]" << std::endl;

      // TODO (Vmon): Error handling and return
      outlineProxyController_->routeThroughOutline(outline_server_ip);
      std::cout << "Configure Routing to " << outline_server_ip << " is done." << std::endl;
      return SUCCESS;

    } else if (action == RESET_ROUTING) {
      // TODO (Vmon): Error handling and return
      outlineProxyController_->routeDirectly();
      std::cout << "Reset Routing done" << std::endl;
      return SUCCESS;
    } else {
      std::cerr << "Invalid action specified in JSON (" << action << ")" << std::endl;
    }

    return GENERIC_FAILURE;
  }

  stream_protocol::socket socket_;
  boost::asio::io_context::strand strand_;
  std::shared_ptr<OutlineProxyController> outlineProxyController_;
};

class OutlineControllerServer {
 public:
  OutlineControllerServer(boost::asio::io_context& io_context, const std::string& file)
      : outlineProxyController_(std::make_shared<OutlineProxyController>()),
        unix_socket_name(file)

  {
    ::unlink(unix_socket_name.c_str());
    boost::asio::spawn(io_context, [&](boost::asio::yield_context yield) {
      stream_protocol::acceptor acceptor(io_context, stream_protocol::endpoint(unix_socket_name));
      auto result = chmod(
          unix_socket_name.c_str(),
          S_IRWXU | S_IROTH | S_IWOTH);  // enables all user to read from and write into socket

      for (;;) {
        boost::system::error_code ec;
        stream_protocol::socket socket(io_context);
        acceptor.async_accept(socket, yield[ec]);
        if (!ec) std::make_shared<session>(std::move(socket), outlineProxyController_)->start();
      }
    });
  }

 private:
  std::shared_ptr<OutlineProxyController> outlineProxyController_;
  std::string unix_socket_name;
};

}  // namespace outline
#else  // defined(BOOST_ASIO_HAS_LOCAL_SOCKETS)
#error Local sockets not available on this platform.
#endif  // defined(BOOST_ASIO_HAS_LOCAL_SOCKETS)
