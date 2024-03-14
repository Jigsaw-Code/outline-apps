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

#include <cstdlib>
#include <ctime>
#include <iostream>

#include <boost/asio.hpp>
#include <boost/filesystem.hpp>
#include <boost/program_options.hpp>

#include <syslog.h>
#include <unistd.h>

#include "logger.h"
#include "outline_controller_server.h"
#include "OutlineProxyControllerConfig.h"

using namespace outline;
using namespace std;
namespace po = boost::program_options;
namespace fs = boost::filesystem;

class ControllerConfig {
 public:
  string socketFilename;
  string loggerFilename;
  uid_t owningUid;

  bool daemonized = false;
  bool onlyShowHelp = false;

  /**
   * Constracutor parses commandline argument.
   *
   * throw exception if mandatory args are not specified
   */
  ControllerConfig(int argc, char* argv[]) {
    po::options_description desc;
    desc.add_options()
      ("help,h", "print this message")
      ("daemonize,d", "run in daemon mode")
      ("socket-filename,s", po::value<string>(),
       "unix socket filename where controller listen on for commands")
      ("owning-user-id,u", po::value<uid_t>()->default_value(-1),
       "id of the user who owns socket-filename")
      ("log-filename,l", po::value<string>(), "the filename to store the loggers output");

    po::variables_map vm;
    po::store(po::parse_command_line(argc, argv, desc), vm);
    po::notify(vm);

    if (vm.count("help")) {
      cerr << desc << "\n";
      onlyShowHelp = true;
      return;
    }

    if (!vm.count("socket-filename")) {
      cout << desc << "\n";
      throw std::runtime_error("missing socket-filename argument is mandatory");
    }

    socketFilename = fs::path(vm["socket-filename"].as<string>()).string();

    if (vm.count("log-filename")) {
      loggerFilename = fs::path(vm["log-filename"].as<string>()).string();
      logger.config(true, true, loggerFilename);  // Log to the log file in addition to stderr
    }

    if (vm.count("daemonize")) {
      daemonized = true;
    }

    owningUid = vm["owning-user-id"].as<uid_t>();
  }
};

int main(int argc, char* argv[]) {
  std::cout << OUTLINEVPN_NAME << " [for OutlineVPN Client] v" << OUTLINEVPN_VERSION << std::endl;

  try {
    boost::asio::io_context io_context;

    try {
      ControllerConfig config(argc, argv);
      if (config.onlyShowHelp) return EXIT_SUCCESS;

      // Initialise the server. No need to make_shared because io_context.run() will
      // block until all asynchronous operations ended.
      OutlineControllerServer server{config.socketFilename, config.owningUid};
      boost::asio::co_spawn(io_context, server.Start(), boost::asio::detached);

      io_context.run();
    } catch (std::exception& e) {
      syslog(LOG_ERR | LOG_USER, "Exception: %s", e.what());
      std::cerr << "Exception: " << e.what() << std::endl;
    }
  } catch (exception& e) {
    logger.error("FATAL Error:" + string(e.what()));
    return EXIT_FAILURE;
  }

  return EXIT_SUCCESS;
}
