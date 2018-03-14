/*
 * Copyright (C) Psiphon Inc.
 * Released under badvpn licence: https://github.com/ambrop72/badvpn#license
 */

package ca.psiphon;

public class Tun2Socks {

    // runTun2Socks takes a tun device file descriptor (from Android's VpnService,
    // for example) and plugs it into tun2socks, which routes the tun TCP traffic
    // through the specified SOCKS proxy. UDP traffic is sent to the specified
    // udpgw server.
    //
    // The tun device file descriptor should be set to non-blocking mode.
    // tun2Socks takes ownership of the tun device file descriptor and will close
    // it when tun2socks is stopped.
    //
    // runTun2Socks blocks until tun2socks is stopped by calling terminateTun2Socks.
    // It's safe to call terminateTun2Socks from a different thread.
    //
    // logTun2Socks is called from tun2socks when an event is to be logged.

    private native static int runTun2Socks(
            int vpnInterfaceFileDescriptor,
            int vpnInterfaceMTU,
            String vpnIpAddress,
            String vpnNetMask,
            String socksServerAddress,
            String udpgwServerAddress,
            int udpgwTransparentDNS);
    
    private native static int terminateTun2Socks();

    public static void logTun2Socks(String level, String channel, String msg) {
    }

    static {
        System.loadLibrary("tun2socks");
    }
}
