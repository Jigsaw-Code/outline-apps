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

package org.outline.shadowsocks;

import android.content.Context;
import java.util.Locale;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.json.JSONException;
import org.json.JSONObject;

// Manages the life cycle and configuration of ss-local, the Shadowsocks client library.
public class Shadowsocks {
  private static final Logger LOG = Logger.getLogger(Shadowsocks.class.getName());
  private static final String LIB_SS_LOCAL_NAME = "libss-local.so";
  private static final int PROCESS_START_WAIT_MS = 250;
  public static final String LOCAL_SERVER_ADDRESS = "127.0.0.1";
  public static final String LOCAL_SERVER_PORT = "9999";
  public static final int SS_LOCAL_TIMEOUT_SECS = Integer.MAX_VALUE;

  private final String ssPath;
  private Process ssProcess;

  public Shadowsocks(final Context context) {
    final String nativeLibraryDir =
        context.getApplicationContext().getApplicationInfo().nativeLibraryDir;
    this.ssPath = String.format(Locale.ROOT, "%s/%s", nativeLibraryDir, LIB_SS_LOCAL_NAME);
  }

  // Launches ss-local as a separate process with the provided configuration.
  public synchronized boolean start(JSONObject serverConfig) throws JSONException {
    LOG.info("starting ss-local");
    try {
      this.stopShadowsocksProcess(); // Try to stop in case there is a previous instance running.
      this.ssProcess = new ProcessBuilder(
        this.ssPath,
        "-s", serverConfig.getString("host"),
        "-p", serverConfig.getString("port"),
        "-k", serverConfig.getString("password"),
        "-b", LOCAL_SERVER_ADDRESS,
        "-l", LOCAL_SERVER_PORT,
        "-m", serverConfig.getString("method"),
        "-t", String.format(Locale.ROOT, "%d", SS_LOCAL_TIMEOUT_SECS),
        "-u"
        ).start();
      // Wait for the process to start and report whether it is running.
      Thread.sleep(PROCESS_START_WAIT_MS);
      return isRunning(ssProcess);
    } catch (Exception e) {
      LOG.log(Level.SEVERE, "Failed to start ss-local", e);
    }
    return false;
  }

  public synchronized void stop() {
    stopShadowsocksProcess();
  }

  private void stopShadowsocksProcess() {
    if (this.ssProcess != null) {
      LOG.info("stopping ss-local");
      this.ssProcess.destroy();
      this.ssProcess = null;
    }
  }

  // Returns the IP address and port on which ss-local is listening. Throws an exception if ss-local
  // has not been started.
  public synchronized String getLocalServerAddress() throws IllegalStateException {
    if (this.ssProcess == null) {
      throw new IllegalStateException("ss-local has not been started");
    }
    return String.format(Locale.ROOT, "%s:%s", LOCAL_SERVER_ADDRESS, LOCAL_SERVER_PORT);
  }

  // Returns whether |process| is running.
  private boolean isRunning(final Process process) {
    if (process == null) {
      return  false;
    }
    try {
      process.exitValue();
    } catch (IllegalThreadStateException e) {
      return true;  // Process is running
    }
    return false;
  }

}
