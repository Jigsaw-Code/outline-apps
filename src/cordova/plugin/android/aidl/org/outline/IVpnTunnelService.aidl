// Copyright 2020 The Outline Authors
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

package org.outline;

import org.outline.TunnelConfig;

/**
 * AIDL for org.outline.vpn.VpnTunnelService.
 */
interface IVpnTunnelService {
  /**
   * Establishes a system-wide VPN connected to a remote Shadowsocks proxy server.
   * All device traffic is routed as follows:
   *  |VPN TUN interface| <-> |outline-go-tun2socks| <-> |Shadowsocks server|.
   *
   * This method can be called multiple times with different configurations. The VPN will not be
   * torn down. Broadcasts an intent with action OutlinePlugin.Action.START and an error code
   * extra with the result of the operation, as defined in OutlinePlugin.ErrorCode. Displays a
   * persistent notification for the duration of the tunnel.
   *
   * @param config tunnel configuration parameters.
   * @param isAutoStart boolean whether the tunnel was started without user intervention.
   * @return error code as defined in OutlinePlugin.ErrorCode.
   */
  int startTunnel(in TunnelConfig config);

  /**
   * Tears down a tunnel started by calling `startTunnel`. Stops tun2socks, shadowsocks, and
   * the system-wide VPN.
   *
   * @param tunnelId unique identifier for the tunnel.
   * @return error code representing whether the operation was successful.
   */
  int stopTunnel(String tunnelId);

  /**
   * Determines whether a tunnel has been started.
   *
   * @param tunnelId unique identifier for the tunnel.
   * @return boolean indicating whether the tunnel is active.
   */
  boolean isTunnelActive(String tunnelId);

  /**
   * Determines whether a server is reachable via TCP.
   *
   * @param host IP or hostname string.
   * @return port TCP port number.
   */
  boolean isServerReachable(String host, int port);

  /**
   * Initializes the error reporting framework on the VPN service process.
   *
   * @param apiKey Sentry API key.
   */
  void initErrorReporting(String apiKey);
}
