package org.outline.tun2socks;

import android.os.ParcelFileDescriptor;
import java.util.logging.Logger;

/**
 * Wrapper class for go-tun2socks.
 */
public class Tun2Socks {
  private static final String LOG_TAG = "Tun2Socks";
  private static final Logger LOG = Logger.getLogger(LOG_TAG);

  /**
   * Starts directing traffic through tun2socks. Blocks until `Tun2Socks.stop` is called.
   *
   * @param tunFd file descriptor to the VPN TUN device; used to receive traffic.  Should be set to
   *        blocking mode. Tun2Socks does *not* take ownership of the file descriptor;
   *        the caller is responsible for closing it after tun2socks terminates.
   * @param socksServerAddress IP address of the SOCKS proxy server.
   * @param socksServerAddress port of the SOCKS proxy server.
   */
  public static void start(final ParcelFileDescriptor tunFd, final String socksServerAddress,
      short socksServerPort) throws IllegalArgumentException {
    if (tunFd == null || socksServerAddress == null || socksServerPort <= 0) {
      throw new IllegalArgumentException("Must provide a TUN file descriptor, proxy host and port");
    }
    tun2socks.Tun2socks.startSocks(tunFd.getFd(), socksServerAddress, socksServerPort);
  }

  /**
   * Stops directing traffic through tun2socks.
   */
  public static void stop() {
    tun2socks.Tun2socks.stopSocks();
  }
}
