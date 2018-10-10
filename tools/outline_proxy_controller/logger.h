#include <fstream>
#include <iostream>

#ifndef SRC_LOGGER_H_
#define SRC_LOGGER_H_

namespace outline {

// Standard log levels, ascending order of specificity.
enum log_level_t { SILLY, DEBUG, VERBOSE, INFO, WARN, ERROR, ABORT };

const log_level_t default_log_level = DEBUG;

class Logger {
 protected:
  log_level_t threshold;
  bool log_to_stderr;
  bool log_to_file;
  std::string log_filename;
  std::ofstream log_file;

  /************************* Time Functions **************************/

  int timeval_subtract(struct timeval *x, struct timeval *y, struct timeval *result) {
    /* Perform the carry for the later subtraction by updating y. */
    if (x->tv_usec < y->tv_usec) {
      int nsec = (y->tv_usec - x->tv_usec) / 1000000 + 1;
      y->tv_usec -= 1000000 * nsec;
      y->tv_sec += nsec;
    }
    if (x->tv_usec - y->tv_usec > 1000000) {
      int nsec = (x->tv_usec - y->tv_usec) / 1000000;
      y->tv_usec += 1000000 * nsec;
      y->tv_sec -= nsec;
    }

    /* Compute the time remaining to wait.
       tv_usec is certainly positive. */
    result->tv_sec = x->tv_sec - y->tv_sec;
    result->tv_usec = x->tv_usec - y->tv_usec;

    /* Return 1 if result is negative. */
    return x->tv_sec < y->tv_sec;
  }

  struct timeval log_ts_base;
  /** Get a timestamp, as a floating-point number of seconds. */
  double log_get_timestamp();

 public:
  std::string state_to_text[0xFF];         // TOTAL_NO_OF_STATES
  std::string message_type_to_text[0xFF];  // TOTAL_NO_OF_MESSAGE_TYPE];

  // put name on states and message types
  void initiate_textual_conversions();

  // Constructor sets an initial threshold
  Logger(log_level_t threshold);
  // Destructor closes an open log file
  ~Logger();

  // Get the current log file name
  std::string current_log_file() { return log_filename; }

  void config(bool log_stderr, bool log_file, std::string fname);
  void set_threshold(log_level_t level);
  void log(log_level_t level, std::string msg, std::string function_name = "",
           std::string user_nick = "");
  void silly(std::string msg, std::string function_name = "", std::string user_nick = "");
  void debug(std::string msg, std::string function_name = "", std::string user_nick = "");
  void verbose(std::string msg, std::string function_name = "", std::string user_nick = "");
  void info(std::string msg, std::string function_name = "", std::string user_nick = "");
  void warn(std::string msg, std::string function_name = "", std::string user_nick = "");
  void error(std::string msg, std::string function_name = "", std::string user_nick = "");
  void abort(std::string msg, std::string function_name = "", std::string user_nick = "");

  void assert_or_die(bool expr, std::string failure_message, std::string function_name = "",
                     std::string user_nick = "");
};

}  // namespace outline

#endif  // SRC_LOGGER_H_
