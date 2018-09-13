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

package org.outline.vpn;

import android.os.ParcelFileDescriptor;
import java.io.IOException;
import java.util.Random;
import java.util.Locale;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.outline.tun2socks.Tun2SocksJni;

/**
 * Manages the life-cycle of the system VPN, and of the tunnel that processes its traffic.
 */
public class VpnTunnel {
  private static final Logger LOG = Logger.getLogger(VpnTunnel.class.getName());

  private static final String VPN_INTERFACE_PRIVATE_LAN = "10.111.222.%s";
  private static final int VPN_INTERFACE_PREFIX_LENGTH = 24;
  private static final String VPN_INTERFACE_NETMASK = "255.255.255.0";
  private static final String VPN_IPV6_NULL = null;  // No IPv6 support.
  private static final int VPN_INTERFACE_MTU = 1500;
  // OpenDNS and Dyn IP addresses.
  private static final String[] DNS_RESOLVER_IP_ADDRESSES = {
    "216.146.35.35", "216.146.36.36",
    "208.67.222.222", "208.67.220.220"
  };
  private static final int DNS_RESOLVER_PORT = 53;
  private static final int TRANSPARENT_DNS_ENABLED = 1;
  private static final int SOCKS5_UDP_ENABLED = 1;

  private final VpnTunnelService vpnService;
  private String dnsResolverAddress;
  private ParcelFileDescriptor tunFd;
  private Thread tun2socksThread = null;

  /**
   * Constructor.
   *
   * @param vpnService (required) service to access system VPN APIs.
   * @throws IllegalArgumentException if |vpnService| is null.
   */
  public VpnTunnel(VpnTunnelService vpnService) {
    if (vpnService == null) {
      throw new IllegalArgumentException("Must provide a VPN service instance");
    }
    this.vpnService = vpnService;
  }

  /**
   * Establishes a system-wide VPN that routes all device traffic to its TUN interface. Randomly
   * selects between OpenDNS and Dyn resolvers to set the VPN's DNS resolvers.
   *
   * @return boolean indicating whether the VPN was successfully established.
   */
  public boolean establishVpn() {
    LOG.info("Establishing the VPN.");
    try {
      dnsResolverAddress = selectDnsResolverAddress();
      tunFd = vpnService.newBuilder()
                  .setSession(vpnService.getApplicationName())
                  .setMtu(VPN_INTERFACE_MTU)
                  .addAddress(String.format(Locale.ROOT, VPN_INTERFACE_PRIVATE_LAN, "1"),
                      VPN_INTERFACE_PREFIX_LENGTH)
                  .addRoute("0.0.0.0", 0)
                  .addDnsServer(dnsResolverAddress)
                  .addDisallowedApplication(vpnService.getPackageName())
                  .establish();
      return tunFd != null;
    } catch (Exception e) {
      LOG.log(Level.SEVERE, "Failed to establish the VPN", e);
    }
    return false;
  }

  /* Stops routing device traffic through the VPN. */
  public void tearDownVpn() {
    LOG.info("Tearing down the VPN.");
    if (tunFd == null) {
      return;
    }
    try {
      tunFd.close();
    } catch (IOException e) {
      LOG.severe("Failed to close the VPN interface file descriptor.");
    } finally {
      tunFd = null;
    }
  }

  /**
   * Connects a tunnel between a SOCKS server and the VPN TUN interface, by using the tun2socks
   * native library.
   *
   * @param socksServerAddress IP address of the SOCKS server.
   * @throws IllegalArgumentException if |socksServerAddress| is null.
   * @throws IllegalStateException if the VPN has not been established, or the tunnel is already
   *     connected.
   */
  public void connectTunnel(final String socksServerAddress) {
    LOG.info("Connecting the tunnel.");
    if (socksServerAddress == null) {
      throw new IllegalArgumentException("Must provide an IP address to a SOCKS server.");
    }
    if (tunFd == null) {
      throw new IllegalStateException("Must establish the VPN before connecting the tunnel.");
    }
    if (tun2socksThread != null) {
      throw new IllegalStateException("Tunnel already connected");
    }

    LOG.fine("Starting tun2socks thread");
    tun2socksThread =
        new Thread() {
          public void run() {
            Tun2SocksJni.start(tunFd.getFd(), VPN_INTERFACE_MTU,
                String.format(Locale.ROOT, VPN_INTERFACE_PRIVATE_LAN, "2"), // Router IP address
                VPN_INTERFACE_NETMASK, VPN_IPV6_NULL, socksServerAddress,
                socksServerAddress, // UDP relay IP address
                String.format(Locale.ROOT, "%s:%d", dnsResolverAddress, DNS_RESOLVER_PORT),
                TRANSPARENT_DNS_ENABLED, SOCKS5_UDP_ENABLED);
          }
        };
    tun2socksThread.start();
  }

  /* Disconnects a tunnel created by a previous call to |connectTunnel|. */
  public void disconnectTunnel() {
    LOG.info("Disconnecting the tunnel.");
    if (tun2socksThread == null) {
      return;
    }
    try {
      Tun2SocksJni.stop();
      tun2socksThread.join();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    } finally {
      tun2socksThread = null;
    }
  }

  /* Returns a random IP address from |DNS_RESOLVER_IP_ADDRESSES|. */
  private String selectDnsResolverAddress() {
    return DNS_RESOLVER_IP_ADDRESSES[new Random().nextInt(DNS_RESOLVER_IP_ADDRESSES.length)];
  }
}
