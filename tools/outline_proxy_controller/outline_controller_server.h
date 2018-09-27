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

#include "outline_proxy_controller.h"

#if defined(BOOST_ASIO_HAS_LOCAL_SOCKETS)

using boost::asio::local::stream_protocol;
using namespace std;

namespace outline {

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
        std::string clientCommand;
        for (;;) {
          std::size_t n = boost::asio::async_read_until(
              socket_, boost::asio::dynamic_buffer(clientCommand, 1024), "\n", yield);
          runClientCommand(clientCommand.substr(0, n - 1));
          clientCommand.erase(0, n);
        }
      } catch (std::exception& e) {
        socket_.close();
      }
    });
  }

 private:
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
