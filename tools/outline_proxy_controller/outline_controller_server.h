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

using namespace std;
using boost::asio::local::stream_protocol;

namespace outline {

// Routing commands from App
const std::string CONFIGURE_ROUTING = "configureRouting";
const std::string RESET_ROUTING = "resetRouting";
const std::string GET_DEVICE_NAME = "getDeviceName";

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
  /**
   * callback from async_accept, starts a new session when
   * a connection is comming in and reads the input from
   * the client
   */
  void start();

 private:
  /**
   * Checks the input string and returns true if it's a valid json
   */
  bool isValidJson(std::string str);

  /**
   * interprets the commmands arriving as JSON input from the client app and
   * act upon them
   */
  std::tuple<int, std::string, std::string> runClientCommand(std::string clientCommand);

  stream_protocol::socket socket_;
  boost::asio::io_context::strand strand_;
  std::shared_ptr<OutlineProxyController> outlineProxyController_;
};

class OutlineControllerServer {
 public:
  /*
   * constructor: setup a listener on the file as a unix socket
   */
  OutlineControllerServer(boost::asio::io_context& io_context, const std::string& file);

 private:
  std::shared_ptr<OutlineProxyController> outlineProxyController_;
  std::string unix_socket_name;
};

}  // namespace outline
#else  // defined(BOOST_ASIO_HAS_LOCAL_SOCKETS)
#error Local sockets not available on this platform.
#endif  // defined(BOOST_ASIO_HAS_LOCAL_SOCKETS)
