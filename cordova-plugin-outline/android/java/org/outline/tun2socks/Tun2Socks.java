package org.outline.tun2socks;

import android.os.ParcelFileDescriptor;
import java.io.FileDescriptor;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.Locale;
import java.util.logging.Logger;

/**
 * Wrapper class for go-tun2socks.
 */
public class Tun2Socks {
  private static final String LOG_TAG = "Tun2Socks";
  private static final Logger LOG = Logger.getLogger(LOG_TAG);
  private static final int MTU = 1500;

  private static PacketFlow packetFlow;
  private static volatile boolean isRunning = false;

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
    final FileDescriptor fd = tunFd.getFileDescriptor();
    packetFlow = new PacketFlow(new FileOutputStream(fd));
    tun2socks.Tun2socks.startSocks(packetFlow, socksServerAddress, socksServerPort);
    isRunning = true;
    readPackets(new FileInputStream(fd));
  }

  /**
   * Stops directing traffic through tun2socks.
   */
  public static void stop() {
    isRunning = false;
    tun2socks.Tun2socks.stopSocks();
    packetFlow.close();
  }

  /**
   * Reads packets from `inputStream` and writes them to tun2socks.
   */
  private static void readPackets(FileInputStream inputStream) {
    ByteBuffer buffer = ByteBuffer.allocate(MTU);
    while (isRunning) {
      try {
        int readBytes = inputStream.read(buffer.array());
        if (readBytes <= 0) {
          LOG.warning(String.format(Locale.ROOT, "Read %d bytes from TUN", readBytes));
          continue;
        }
        buffer.limit(readBytes);
        tun2socks.Tun2socks.inputPacket(buffer.array());
        buffer.clear();
      } catch (IOException e) {
        LOG.severe(
            String.format(Locale.ROOT, "Failed to read packet from TUN: %s", e.getMessage()));
      }
    }
    try {
      inputStream.close();
    } catch (IOException e) {
      LOG.warning("Failed to close TUN input stream");
    }
  }

  /**
   * Implementation of the `tun2socks.PacketFlow` interface. tun2socks calls this class'
   * `writePacket` method to send data to the VPN.
   */
  private static class PacketFlow implements tun2socks.PacketFlow {
    private FileOutputStream outputStream;

    PacketFlow(FileOutputStream outputStream) {
      this.outputStream = outputStream;
    }

    @Override
    public void writePacket(byte[] packet) {
      try {
        outputStream.write(packet);
      } catch (IOException e) {
        LOG.severe(String.format(Locale.ROOT, "Failed to write packet to TUN: %s", e.getMessage()));
      }
    }

    public void close() {
      try {
        outputStream.close();
      } catch (IOException e) {
        LOG.warning("Failed to close TUN output stream");
      }
    }
  }
}
