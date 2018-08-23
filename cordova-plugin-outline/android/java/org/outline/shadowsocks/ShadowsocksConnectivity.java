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

import java.io.BufferedReader;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.ConnectException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.nio.ByteBuffer;
import java.util.Locale;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.Random;

/**
 * Class that performs connectivity tests on remote Shadowsocks servers.
 *
 */
public class ShadowsocksConnectivity {
  private static final Logger LOG = Logger.getLogger(ShadowsocksConnectivity.class.getName());
  private static final int SOCKS_RESPONSE_NUM_BYTES = 10;
  private static final byte SOCKS_CMD_CONNECT = 0x1;
  private static final byte SOCKS_ATYP_IPV4 = 1;
  private static final byte SOCKS_ATYP_DOMAINNAME = 3;;
  private static final byte SOCKS_VERSION = 0x5;
  private static final int SOCKS_HEADER_ATYP = 3;
  private static final int SOCKS_METHODS_HEADER_NUM_BYTES = 3;
  private static final int SOCKS_METHODS_RESPONSE_NUM_BYTES = 2;
  private static final byte SOCKS_N_METHODS = 1;
  private static final byte SOCKS_METHOD_NOAUTH = 0;
  private static final int SOCKS_TCP_HEADER_NUM_BYTES = 6;
  // We have chosen these domains due to their neutrality.
  private static final String[] CREDENTIALS_VALIDATION_DOMAINS = {"eff.org", "ietf.org", "w3.org",
                                                                  "wikipedia.org", "example.com"};
  private static final short CREDENTIALS_VALIDATION_PORT = 80;
  private static final int TCP_SOCKET_TIMEOUT_MS = 10000;
  private static final int UDP_SOCKET_TIMEOUT_MS = 1000;
  private static final int UDP_MAX_RETRY_ATTEMPTS = 5;
  private static final int UDP_MAX_BUFFER_NUM_BYTES = 512;
  private static final String DNS_RESOLVER_IP = "208.67.222.222";  // OpenDNS
  private static final short DNS_RESOLVER_PORT = 53;
  private static final int SERVER_CONNECT_MAX_ATTEMPTS = 3;
  private static final int SERVER_CONNECT_RETRY_SLEEP_MS = 500;

  // Returns whether the server is reachable at the supplied IP address.
  public static boolean isServerReachable(final String ip, int port) {
    return isAddressReachable(new InetSocketAddress(ip, port));
  }

  /**
   * Verifies that the remote server credentials are valid. Performs an end-to-end authentication
   * test by issuing an HTTP HEAD request to a target domain.
   */
  public static boolean validateServerCredentials(final String localProxyIp, final int localProxyPort) {
    LOG.fine("Starting server creds. validation.");
    Socket socket = null;
    DataOutputStream outputStream = null;
    DataInputStream inputStream = null;
    try {
      InetSocketAddress localProxyAddress = new InetSocketAddress(localProxyIp, localProxyPort);
      if (!waitForLocalShadowsocksServer(localProxyAddress)) {
        return false;
      }
      socket = new Socket();
      socket.setSoTimeout(TCP_SOCKET_TIMEOUT_MS);
      socket.connect(localProxyAddress);
      outputStream = new DataOutputStream(socket.getOutputStream());
      inputStream = new DataInputStream(socket.getInputStream());

      byte[] buffer = getSocksMethodsRequest();
      outputStream.write(buffer);
      buffer = new byte[SOCKS_METHODS_RESPONSE_NUM_BYTES];
      inputStream.readFully(buffer);  // Don't parse, we already know the response is NOAUTH

      final String targetDomain = chooseRandomDomain();
      buffer = getSocksTcpRequest(targetDomain);
      outputStream.write(buffer);
      buffer = new byte[SOCKS_RESPONSE_NUM_BYTES];
      inputStream.readFully(buffer);  // Don't parse, this is a fake response

      final String httpRequest =
          String.format(Locale.ROOT, "HEAD / HTTP/1.1\r\nHost: %s\r\n\r\n", targetDomain);
      outputStream.write(httpRequest.getBytes());
      BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
      final String httpResponse = reader.readLine();
      return httpResponse != null && httpResponse.startsWith("HTTP/1.1");
    } catch (IOException e) {
      LOG.log(Level.WARNING, "Got exception in server creds. validation", e);
    } finally {
      closeSocket(socket);
    }
    return false;
  }

  /**
   * Verifies that the server has enabled UDP forwarding. Sends a DNS request through the remote on
   * the specified local proxy address.
   */
  public static boolean isUdpForwardingEnabled(final String localProxyIp, final int localProxyPort) {
    LOG.fine("Starting UDP forwarding validation");
    DatagramSocket socket = null;
    try {
      InetSocketAddress localProxyAddress = new InetSocketAddress(localProxyIp, localProxyPort);
      if (!waitForLocalShadowsocksServer(localProxyAddress)) {
        return false;
      }
      byte[] buffer = getSocksUdpRequest();
      DatagramPacket dnsRequest = new DatagramPacket(buffer, buffer.length, localProxyAddress);
      DatagramPacket dnsResponse = new DatagramPacket(new byte[UDP_MAX_BUFFER_NUM_BYTES],
                                                      UDP_MAX_BUFFER_NUM_BYTES);
      socket = new DatagramSocket();
      socket.setSoTimeout(UDP_SOCKET_TIMEOUT_MS);

      int attempt = 1;
      boolean success = false;
      while (attempt <= UDP_MAX_RETRY_ATTEMPTS) {
        LOG.info(String.format(Locale.ROOT, "Checking remote UDP forwarding (%d/%d)", attempt,
            UDP_MAX_RETRY_ATTEMPTS));
        socket.send(dnsRequest);
        try {
          socket.receive(dnsResponse);
          success = true;
          break;
        } catch (SocketTimeoutException e) {
          LOG.warning("UDP forwarding validation timed out.");
          ++attempt;
        }
      }
      return success;
    } catch (IOException e) {
      LOG.log(Level.SEVERE, "Unexpected exception in UDP forwarding validation", e);
      return false;
    } finally {
      if (socket != null) {
        socket.close();
      }
    }
  }

  // Returns whether |address| is reachable.
  private static boolean isAddressReachable(InetSocketAddress address) {
    Socket socket = null;
    try {
      socket = new Socket();
      socket.connect(address, TCP_SOCKET_TIMEOUT_MS);
      return true;
    } catch (Exception e) {
      LOG.log(Level.WARNING, "Connection failure while determining address reachability", e);
    } finally {
      closeSocket(socket);
    }
    return false;
  }

  // Returns whether |serverAddress| is reachable. Attempts to connect up to three times,
  // sleeping in between.
  private static boolean waitForLocalShadowsocksServer(InetSocketAddress serverAddress) {
    for (int attempt = 0; attempt < SERVER_CONNECT_MAX_ATTEMPTS; ++attempt) {
      if (isAddressReachable(serverAddress)) {
        return true;
      }
      try {
        Thread.sleep(SERVER_CONNECT_RETRY_SLEEP_MS);
      } catch (InterruptedException e) {
        // We shouldn't get here, but if we do return true to avoid a false negative.
        LOG.warning("Connectivity test interrupted");
        return true;
      }
    }
    LOG.severe(String.format(Locale.ROOT, "Failed to reach server after %d attempts, giving up",
        SERVER_CONNECT_MAX_ATTEMPTS));
    return false;
  }

  // Synthesizes a SOCKS UDP request with a DNS query as payload.
  private static byte[] getSocksUdpRequest() throws IOException {
    InetAddress dnsResolverAddress = null;
    try {
      dnsResolverAddress = InetAddress.getByName(DNS_RESOLVER_IP);
    } catch (UnknownHostException e) {
      throw new IOException("Failed to compose a SOCKS UDP request", e);
    }
    ByteBuffer buffer = ByteBuffer.allocate(UDP_MAX_BUFFER_NUM_BYTES);
    // Construct SOCKS UDP header
    buffer.position(SOCKS_HEADER_ATYP);
    buffer.put(SOCKS_ATYP_IPV4).put(dnsResolverAddress.getAddress()).putShort(DNS_RESOLVER_PORT)
    // Copy DNS Request
        .put(getDnsRequest());
    return buffer.array();
  }

  // Synthesizes a DNS request for google.com
  private static byte[] getDnsRequest() throws IOException {
    return new byte[] {
      0, 0,  // [0-1]   query ID
      1, 0,  // [2-3]   flags; byte[2] = 1 for recursion desired (RD).
      0, 1,  // [4-5]   QDCOUNT (number of queries)
      0, 0,  // [6-7]   ANCOUNT (number of answers)
      0, 0,  // [8-9]   NSCOUNT (number of name server records)
      0, 0,  // [10-11] ARCOUNT (number of additional records)
      6, 'g', 'o', 'o', 'g', 'l', 'e',
      3, 'c', 'o', 'm',
      0,  // null terminator of FQDN (root TLD)
      0, 1, // QTYPE, set to A
      0, 1  // QCLASS, set to 1 = IN (Internet)
    };
  }

  // Synthesizes a SOCKS TCP CONNECT header to |domain| on port 80.
  private static byte[] getSocksTcpRequest(final String domain) {
    ByteBuffer buffer = ByteBuffer.allocate(SOCKS_TCP_HEADER_NUM_BYTES +
                                            domain.length() + 1 /* domain length byte */);
    buffer.put(SOCKS_VERSION).put(SOCKS_CMD_CONNECT);
    buffer.position(SOCKS_HEADER_ATYP);
    buffer.put(SOCKS_ATYP_DOMAINNAME).put((byte)domain.length()).put(domain.getBytes())
        .putShort(CREDENTIALS_VALIDATION_PORT);
    return buffer.array();
  }

  private static byte[] getSocksMethodsRequest() {
    ByteBuffer buffer = ByteBuffer.allocate(SOCKS_METHODS_HEADER_NUM_BYTES);
    return buffer.put(SOCKS_VERSION).put(SOCKS_N_METHODS).put(SOCKS_METHOD_NOAUTH).array();
  }

  private static void closeSocket(Socket socket) {
    try {
      if (socket != null && !socket.isClosed()) {
        socket.close();
      }
    } catch (IOException e) { /* Ignore */ }
  }

  // Returns a random domain from |CREDENTIALS_VALIDATION_DOMAINS|.
  private static final String chooseRandomDomain() {
    int index = new Random().nextInt(CREDENTIALS_VALIDATION_DOMAINS.length);
    return CREDENTIALS_VALIDATION_DOMAINS[index];
  }
}

