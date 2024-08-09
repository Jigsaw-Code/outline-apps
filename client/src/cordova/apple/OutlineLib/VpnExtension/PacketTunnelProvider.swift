//
//  PacketTunnelProvider.swift
//  VpnExtension
//
//  Created by Vinicius Fortuna on 8/9/24.
//

import NetworkExtension
import os.log

private let log = OSLog(subsystem: "org.getoutline.PacketTunnelProvider", category: "vpn")

class PacketTunnelProvider: NEPacketTunnelProvider {

    override func startTunnel(options: [String : NSObject]?, completionHandler: @escaping (Error?) -> Void) {
        // Add code here to start the process of connecting the tunnel.
        os_log(.debug, log: log, "PacketTunnelProvider.startTunnel called with options: %{public}@", String(describing: options))
        completionHandler(NEVPNError(NEVPNError.connectionFailed))
    }

    override func stopTunnel(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        // Add code here to start the process of stopping the tunnel.
        os_log("stopTunnel", type:.debug)
        completionHandler()
    }

    override func handleAppMessage(_ messageData: Data, completionHandler: ((Data?) -> Void)?) {
        os_log(.debug, log:log, "handleAppMessage: %{public}@", String(describing:messageData))
        // Add code here to handle the message.
        if let handler = completionHandler {
            handler(messageData)
        }
    }

    override func sleep(completionHandler: @escaping () -> Void) {
        // Add code here to get ready to sleep.
        os_log(.debug, log:log, "Preparing to sleep...")
        completionHandler()
    }

    override func wake() {
        // Add code here to wake up.
        os_log(.debug, log:log, "Waking up...")
    }
}
