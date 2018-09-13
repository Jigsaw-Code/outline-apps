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

package org.outline.tun2socks;

import java.util.logging.Level;
import java.util.Locale;
import java.util.logging.Logger;

public class Tun2SocksJni {
  private static final String TUN2SOCKS = "tun2socks";
  private static final Logger LOG = Logger.getLogger(TUN2SOCKS);
  // Definitions from badvpn BLog.h
  private static final int BLOG_ERROR = 1;
  private static final int BLOG_WARNING = 2;
  private static final int BLOG_NOTICE = 3;
  private static final int BLOG_INFO = 4;
  private static final int BLOG_DEBUG = 5;

  /**
   * Starts the tun2socks native binary. Blocks until tun2socks is stopped.
   *
   * @param vpnInterfaceFileDescriptor file descriptor to the VPN TUN device; used to receive
   *     traffic. Should be set to non-blocking mode. tun2Socks does *not* take ownership of the
   *     file descriptor; the caller is responsible for closing it after tun2socks terminates.
   * @param vpnInterfaceMTU maximum transmission unit of the VPN, in bytes.
   * @param vpnIpAddress router IPv4 address to the VPN.
   * @param vpnNetMask mask of the VPN interface.
   * @param vpnIpV6Address router IPv6 address to the VPN, or null to disable IPv6 support.
   * @param socksServerAddress IP address of the SOCKS server to route TCP traffic.
   * @param udpRelayAddress IP address of the relay to route UDP traffic.
   * @param dnsResolverAddress IP address to a DNS resolver to route DNS queries.
   * @param transparentDNS if non-zero, will resolve DNS queries transparently.
   * @param transparentDNS if non-zero, will direct UDP traffic through the SOCKS server.
   */
  public static native int start(
      int vpnInterfaceFileDescriptor,
      int vpnInterfaceMTU,
      String vpnIpAddress,
      String vpnNetMask,
      String vpnIpV6Address,
      String socksServerAddress,
      String udpRelayAddress,
      String dnsResolverAddress,
      int transparentDNS,
      int socks5UDP);

  /**
   * Terminates tun2socks. This method is safe to call from a different thread than the one
   * tun2socks is running on.
   */
  public static native int stop();

  /** Called from tun2socks when an event is to be logged. */
  public static void log(int level, String channel, String msg) {
    LOG.log(bLogToJavaLogLevel(level), String.format(Locale.ROOT, "(%s): %s", channel, msg));
  }

  static {
    System.loadLibrary(TUN2SOCKS);
  }

  // Converts a BLog level to Java logging level.
  private static Level bLogToJavaLogLevel(int value) {
    switch (value) {
      case BLOG_ERROR:
        return Level.SEVERE;
      case BLOG_WARNING:
        return Level.WARNING;
      case BLOG_NOTICE:
        return Level.INFO;
      case BLOG_INFO:
        return Level.FINE;
      case BLOG_DEBUG:
        return Level.FINER;
      default:
        return Level.FINEST;
    }
  }
}
