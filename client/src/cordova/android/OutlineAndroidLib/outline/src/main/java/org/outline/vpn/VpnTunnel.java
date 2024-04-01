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

import android.net.ConnectivityManager;
import android.net.Network;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Random;
import java.util.logging.Level;
import java.util.logging.Logger;
import tun2socks.Tunnel;
import tun2socks.Tun2socks;


/**
 * Manages the life-cycle of the system VPN, and of the tunnel that processes its traffic.
 */
public class VpnTunnel {
  private static final Logger LOG = Logger.getLogger(VpnTunnel.class.getName());

  private static final String VPN_INTERFACE_PRIVATE_LAN = "10.111.222.%s";
  private static final int VPN_INTERFACE_PREFIX_LENGTH = 24;
  private static final int VPN_INTERFACE_MTU = 1500;
  // OpenDNS, Cloudflare, and Quad9 DNS resolvers' IP addresses.
  private static final String[] DNS_RESOLVER_IP_ADDRESSES = {
      "208.67.222.222", "208.67.220.220", "1.1.1.1", "9.9.9.9"};
  private static final String PRIVATE_LAN_BYPASS_SUBNETS_ID = "reserved_bypass_subnets";

  private final VpnTunnelService vpnService;
  private String dnsResolverAddress;
  private ParcelFileDescriptor tunFd;
  private Tunnel tunnel;

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
   * selects between OpenDNS, Cloudflare, and Quad9 resolvers to set the VPN's DNS resolvers.
   *
   * @return boolean indicating whether the VPN was successfully established.
   */
  public synchronized boolean establishVpn() {
    LOG.info("Establishing the VPN.");
    try {
      dnsResolverAddress = selectDnsResolverAddress();
      VpnService.Builder builder =
          vpnService.newBuilder()
              .setSession(vpnService.getApplicationName())
              .setMtu(VPN_INTERFACE_MTU)
              .addAddress(String.format(Locale.ROOT, VPN_INTERFACE_PRIVATE_LAN, "1"),
                  VPN_INTERFACE_PREFIX_LENGTH)
              .addDnsServer(dnsResolverAddress)
              .setBlocking(true)
              .addDisallowedApplication(vpnService.getPackageName());

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        final Network activeNetwork =
            vpnService.getSystemService(ConnectivityManager.class).getActiveNetwork();
        builder.setUnderlyingNetworks(new Network[] {activeNetwork});
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        builder.setMetered(false);
      }
      // In absence of an API to remove routes, instead of adding the default route (0.0.0.0/0),
      // retrieve the list of subnets that excludes those reserved for special use.
      final ArrayList<Subnet> reservedBypassSubnets = getReservedBypassSubnets();
      for (Subnet subnet : reservedBypassSubnets) {
        builder.addRoute(subnet.address, subnet.prefix);
      }
      tunFd = builder.establish();
      return tunFd != null;
    } catch (Exception e) {
      LOG.log(Level.SEVERE, "Failed to establish the VPN", e);
    }
    return false;
  }

  /* Stops routing device traffic through the VPN. */
  public synchronized void tearDownVpn() {
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
   * Connects a tunnel between a Shadowsocks proxy server and the VPN TUN interface.
   *
   * @param client provides access to the Shadowsocks proxy.
   * @param isUdpEnabled conveys the result of UDP probing.  TODO: Roll this into `client`.
   * @throws IllegalArgumentException if |socksServerAddress| is null.
   * @throws IllegalStateException if the VPN has not been established, or the tunnel is already
   *     connected.
   * @throws Exception when the tunnel fails to connect.
   */
  public synchronized void connectTunnel(final shadowsocks.Client client, boolean isUdpEnabled) throws Exception {
    LOG.info("Connecting the tunnel.");
    if (client == null) {
      throw new IllegalArgumentException("Must provide a Shadowsocks client.");
    }
    if (tunFd == null) {
      throw new IllegalStateException("Must establish the VPN before connecting the tunnel.");
    }
    if (isTunnelConnected()) {
      throw new IllegalStateException("Tunnel already connected");
    }

    LOG.fine("Starting tun2socks...");
    tunnel = Tun2socks.connectShadowsocksTunnel(tunFd.getFd(), client, isUdpEnabled);
  }

  /* Disconnects a tunnel created by a previous call to |connectTunnel|. */
  public synchronized void disconnectTunnel() {
    LOG.info("Disconnecting the tunnel.");
    if (!isTunnelConnected()) {
      return;
    }
    tunnel.disconnect();
    tunnel = null;
  }

  /**
   * Instructs the tunnel to update whether UDP is supported after a network connectivity change.
   *
   * @return boolean indicating whether UDP is supported.
   */
  public synchronized boolean updateUDPSupport() {
    if (!isTunnelConnected()) {
      return false;
    }
    return tunnel.updateUDPSupport();
  }

  private boolean isTunnelConnected() {
    return tunnel != null && tunnel.isConnected();
  }

  /* Returns a random IP address from |DNS_RESOLVER_IP_ADDRESSES|. */
  private String selectDnsResolverAddress() {
    return DNS_RESOLVER_IP_ADDRESSES[new Random().nextInt(DNS_RESOLVER_IP_ADDRESSES.length)];
  }

  /* Returns a subnet list that excludes reserved subnets. */
  private ArrayList<Subnet> getReservedBypassSubnets() {
    final String[] subnetStrings = vpnService.getResources().getStringArray(
        vpnService.getResourceId(PRIVATE_LAN_BYPASS_SUBNETS_ID, "array"));
    ArrayList<Subnet> subnets = new ArrayList<>(subnetStrings.length);
    for (final String subnetString : subnetStrings) {
      try {
        subnets.add(Subnet.parse(subnetString));
      } catch (Exception e) {
        LOG.warning(String.format(Locale.ROOT, "Failed to parse subnet: %s", subnetString));
      }
    }
    return subnets;
  }

  /* Represents an IP subnet. */
  private static class Subnet {
    public String address;
    public int prefix;

    public Subnet(String address, int prefix) {
      this.address = address;
      this.prefix = prefix;
    }

    /* Parses a subnet in CIDR format. */
    public static Subnet parse(final String subnet) throws IllegalArgumentException {
      if (subnet == null) {
        throw new IllegalArgumentException("Must provide a subnet string");
      }
      final String[] components = subnet.split("/", 2);
      if (components.length != 2) {
        throw new IllegalArgumentException("Malformed subnet string");
      }
      return new Subnet(components[0], Integer.parseInt(components[1]));
    }
  }
}
