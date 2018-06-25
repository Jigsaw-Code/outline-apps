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

package org.outline.log;

import android.content.Context;
import android.util.Log;
import java.util.Locale;
import java.util.logging.Handler;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.logging.LogManager;
import java.util.logging.LogRecord;
import org.outline.log.SentryErrorReporter;

/**
 * Static class that adds a custom log handler to the default Java root logger.
 * All messages logged through Java logging will be logged to logcat.
 * Messages with log level INFO, and above, will also be recorded in the error
 * reporting framework. Exceptions are only logged locally to avoid sending
 * sensitive data to the error reporting framework as part of stack traces.
 *
 * All classes in this package should use the Android logging class
 * (android.util.Log) in order to avoid circular dependencies.
 */
public class OutlineLogger {
  private static final String LOG_TAG = OutlineLogger.class.getName();

  // Disallow instantiation in favor of a purely static class.
  private OutlineLogger() {}

  private static final Handler LOG_HANDLER = new Handler() {
    @Override
    public void publish(LogRecord record) {
      Level level = record.getLevel();
      String tag = loggerNameToTag(record.getLoggerName());
      String message = record.getMessage();
      Throwable thrown = record.getThrown();
      recordMessage(level, tag, message, thrown);
    }

    // No need to close nor flush, but must implement abstract methods.
    @Override
    public void close() {}

    @Override
    public void flush() {}
  };

  /**
   * Initializes logging and the underlying error reporting framework.
   *
   * @param context Android application context
   * @param apiKey credentials for the error reporting framework
   */
  public static void initialize(Context context, final String apiKey) {
    initializeLogging();
    initializeErrorReporting(context, apiKey);
  }

  /**
   * Adds a custom log handler to the Java root logger.
   */
  public static void initializeLogging() {
    Logger rootLogger = LogManager.getLogManager().getLogger("");
    // The default ConsoleHandler logs to System.err, we log to logcat. Remove
    // it and any other handlers to improve performance.
    Handler[] handlers = rootLogger.getHandlers();
    for (Handler handler : handlers) {
        rootLogger.removeHandler(handler);
    }
    rootLogger.addHandler(LOG_HANDLER);
    try {
      rootLogger.setLevel(Level.FINER);
    } catch (Exception e) {
      Log.e(LOG_TAG, "Failed to configure root logger", e);
    }
  }

  /**
   * Initializes the error reporting framework with the provided credentials
   *
   * @param context Android application context
   * @param apiKey credentials for the error reporting framework
   */
  public static void initializeErrorReporting(Context context, final String apiKey) {
    try {
      SentryErrorReporter.init(context, apiKey);
    } catch (Exception e) {
      Log.e(LOG_TAG, "Failed to initialize error reporter", e);
    }
  }

  /**
   * Uploads previously recorded logs to the error reporting framework.
   *
   * @param uuid, unique identifier for the report.
   */
  public static void sendLogs(final String uuid) {
    try {
      SentryErrorReporter.send(uuid);
    } catch (Exception e) {
      Log.e(LOG_TAG, "Failed to send logs", e);
    }
  }

  /**
   * Records a message in the error reporting framework if it is above INFO level. Unconditionally
   * prints the message to logcat. Exceptions are only logged locally and not recorded in the error
   * reporting framework.
   */
  private static void recordMessage(
      Level level, final String tag, final String msg, final Throwable thrown) {
    try {
      final String breadcrumb = String.format(Locale.ROOT, "%s:%s", tag, msg);
      int levelValue = level.intValue();
      int androidLevel = Log.DEBUG;
      if (levelValue >= Level.SEVERE.intValue()) {
        SentryErrorReporter.recordErrorMessage(breadcrumb);
        androidLevel = Log.ERROR;
      } else if (levelValue >= Level.WARNING.intValue()) {
        SentryErrorReporter.recordWarningMessage(breadcrumb);
        androidLevel = Log.WARN;
      } else if (levelValue >= Level.INFO.intValue()) {
        SentryErrorReporter.recordInfoMessage(breadcrumb);
        androidLevel = Log.INFO;
      }
      if (thrown != null) {
        Log.e(tag, msg, thrown); // Assume error level if an exception is present.
      } else {
        Log.println(androidLevel, tag, msg);
      }
    } catch (RuntimeException e) {
      Log.e(LOG_TAG, String.format(Locale.ROOT, "Error logging message: [%s] %s", tag, msg), e);
    }
  }

  /**
   * Returns the short logger tag (up to 23 chars) for the given logger name.
   * Traditionally loggers are named by fully-qualified Java classes; this
   * method attempts to return a concise identifying part of such names.
   *
   * Source: https://android.googlesource.com/platform/libcore-snapshot/+/ics-mr1/dalvik/src/main/java/dalvik/system/DalvikLogging.java
   */
  private static String loggerNameToTag(String loggerName) {
    // Anonymous logger.
    if (loggerName == null) {
      return "null";
    }
    int length = loggerName.length();
    if (length <= 23) {
      return loggerName;
    }
    int lastPeriod = loggerName.lastIndexOf(".");
    return length - (lastPeriod + 1) <= 23
        ? loggerName.substring(lastPeriod + 1)
        : loggerName.substring(loggerName.length() - 23);
  }
}
