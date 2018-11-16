#include <syslog.h>
#include <unistd.h>
#include <array>
#include <cstdlib>
#include <ctime>
#include <iostream>

#include <boost/asio/io_context.hpp>
#include <boost/filesystem.hpp>
#include <boost/program_options.hpp>

#include "logger.h"
#include "outline_controller_server.h"

using namespace outline;
using namespace std;
namespace po = boost::program_options;
namespace fs = boost::filesystem;

extern Logger logger;

class ControllerConfig {
 public:
  string socketFilename;
  string loggerFilename;

  bool daemonized = false;
  bool onlyShowHelp = false;

  /**
   * Constracutor parses commandline argument.
   *
   * throw exception if mandatory args are not specified
   */
  ControllerConfig(int argc, char* argv[]) {
    po::options_description desc;
    desc.add_options()("help,h", "print this message")("daemonize,d", "run in daemon mode")(
        "socket-filename,s", po::value<string>(),
        "unix socket filename where controller listen on for commands")(
        "log-filename,l", po::value<string>(), "the filename to store the loggers output");

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
  }
};

int main(int argc, char* argv[]) {
  try {
    boost::asio::io_context io_context;

    try {
      ControllerConfig controllerConfig(argc, argv);

      if (controllerConfig.onlyShowHelp) return EXIT_SUCCESS;

      // Initialise the server.
      OutlineControllerServer server(io_context, controllerConfig.socketFilename);

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
