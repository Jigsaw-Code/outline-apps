// Copyright 2023 The Outline Authors
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

import os.log
import NetworkExtension

import Tun2socks

private let log = OSLog(subsystem: "org.getoutline.OutlinePacketTunnel", category: "vpn")

public enum ConfigKeys: String {
    case tunnelId
    case transport
}

// This must be kept in sync with:
//  - cordova-plugin-outline/apple/vpn/PacketTunnelProvider.h#NS_ENUM
//  - www/model/errors.ts
public enum ErrorCode: Int {
    case noError = 0
    case undefined = 1
    case vpnPermissionNotGranted = 2
    case invalidServerCredentials = 3
    case udpRelayNotEnabled = 4
    case serverUnreachable = 5
    case vpnStartFailure = 6
    case illegalServerConfiguration = 7
    case shadowsocksStartFailure = 8
    case configureSystemProxyFailure = 9
    case noAdminPermissions = 10
    case unsupportedRoutingTable = 11
    case systemMisconfigured = 12
}

class OutlinePacketTunnel: NEPacketTunnelProvider {
    override func startTunnel(options: [String : NSObject]?, completionHandler: @escaping (Error?) -> Void) {
        os_log(.info, log: log, "OutlinePacketTunnel.startTunnel called with options: %{private}@", String(describing: options))
        Task {
            completionHandler(await startTunnelAsync(options: options))
        }
    }
    
    private func startTunnelAsync(options: [String : NSObject]?) async -> Error? {
        os_log(.info, log: log, "Starting tunnel with options: %{public}@", String(describing: options))
        
        guard let protocolConfig = protocolConfiguration as? NETunnelProviderProtocol,
              let providerConfig = protocolConfig.providerConfiguration,
              let transportConfig = providerConfig[ConfigKeys.transport.rawValue] as? [String: Any] else {
            os_log(.error, log: log, "Could not get NETunnelProviderProtocol.providerConfiguration")
            return NEVPNError(.configurationInvalid)
        }
        // TODO: Make this private
        os_log(.info, log: log, "NETunnelProviderProtocol is %{public}@", protocolConfig.description)
        

        let outlineDevice: OutlineDevice
        do {
            // TODO: decouple connectivity test and make it fail only if requested via the options.
            outlineDevice = try await newOutlineDevice(transportConfig: transportConfig)
        } catch {
            os_log(.error, log: log, "Failed to create OutlineDevice: %{public}@", String(describing: error))
            return error
        }
        
        // TODO(fortuna): Figure out what value we want here.
        let networkSettings = getTunnelNetworkSettings(tunnelRemoteAddress: "0.0.0.0")
        do {
            os_log(.info, log: log, "Setting tunnel network settings: %{public}@", networkSettings)
            try await self.setTunnelNetworkSettings(networkSettings)
            os_log(.info, log: log, "Network settings done")
        } catch {
            os_log(.error, log: log, "Network settings failed: %{public}@", String(describing: error))
            return error
        }
        
        // TODO:
        //outlineDevice.relay(with: self.packetFlow)
        
        // - New Device: new Client/device + connectivity
        // - device.Relay()
        //    let client: ShadowsocksClient
        //    switch OutlinePacketTunnel.newClient(transportConfig) {
        //    case .failure(let error):
        //      os_log(.error, log: log, "Failed to create client: %@", String(describing:error))
        //      completionHandler(NEVPNError(.configurationInvalid))
        //    case .success(let result):
        //      client = result
        //    }
        return nil
    }
    
    override func stopTunnel(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        os_log(.info, log:log, "OutlinePacketTunnel.stopTunnel called")
        completionHandler()
        // Stop OnDemand? Perhaps in the caller.
    }
    
    override func handleAppMessage(_ messageData: Data, completionHandler: ((Data?) -> Void)?) {
        os_log(.info, log:log, "Handling app message...")
        if let handler = completionHandler {
            handler(messageData)
        }
    }
    
    override func sleep(completionHandler: @escaping () -> Void) {
        os_log(.info, log:log, "Preparing to sleep...")
        completionHandler()
    }
    
    override func wake() {
        os_log(.info, log:log, "Waking up...")
    }
}

// MARK: - OutlineDevice

class OutlineDevice {
    private let goClient: ShadowsocksClient
    private var isUdpEnabled: Bool
    private var goTunnel: Tun2socksOutlineTunnelProtocol?
    
    init(client: ShadowsocksClient, isUdpEnabled: Bool) {
        self.goClient = client
        self.isUdpEnabled = isUdpEnabled
    }
    
    func relay(with packetFlow: NEPacketTunnelFlow) {
        // TODO: implement Tun2socksTunWriter interface.
        let tunWriter = makeTunWriter(packetFlow)
        var connectError: NSError?
        // Tun2socksConnectShadowsocksTunnel sets up the packet flow from the proxy to the local system, and returns a
        // Tun2socksOutlineTunnelProtocol object to set up the packet flow from the local system to the proxy.
        // TODO: handle error
        self.goTunnel = Tun2socksConnectShadowsocksTunnel(
            tunWriter, self.goClient, self.isUdpEnabled, &connectError);
        //        self.relayFromLocalToProxy()
    }
    
    //    private func relayFromLocalToProxy() {
    //        self.packetFlow.readPacketObjects() { packets in
    //            for packet in packets {
    //                self.goTunnel?.write(<#T##data: Data?##Data?#>, ret0_: <#T##UnsafeMutablePointer<Int>?#>)
    //            }
    //            //
    //            //    }
    //            Task { [weak self] in
    //                self?.relayFromLocalToProxy()
    //            }
    //        }
    //    }
    
    /// Updates the UDP support
    func updateUdpSupport() async {
        guard let goTunnel = self.goTunnel else {
            return
        }
        self.isUdpEnabled = await Task.detached {
            // This function runs the connectivity test, which takes time, so we run it detached.
            return goTunnel.updateUDPSupport()
        }.value
    }
    
    func stop() {
        guard let goTunnel = self.goTunnel else {
            return
        }
        goTunnel.disconnect()
        self.goTunnel = nil
    }
}

private func newGoClient(_ transportConfig: [String: Any]) throws -> ShadowsocksClient {
    // TODO(fortuna): forward config to Go without inspection.
    let ssConfig = ShadowsocksConfig()
    // See ShadowsocksSessionConfig in tunnel.ts
    if let host = transportConfig["host"] as? String {
        ssConfig.host = host
    }
    if let port = transportConfig["port"] as? Int {
        ssConfig.port = port
    }
    if let password = transportConfig["password"] as? String {
        ssConfig.password = password
    }
    if let cipherName = transportConfig["method"] as? String {
        ssConfig.cipherName = cipherName
    }
    if let prefixStr = transportConfig["prefix"] as? String {
        ssConfig.prefix = Data(prefixStr.utf16.map{UInt8($0)})
    }
    // TODO(fortuna): Make it private
    os_log(.info, log:log, "ssConfig is host: %{public}@, port: %{public}@, password: %{public}@, method: %{public}@",
           ssConfig.host, String(describing: ssConfig.port), ssConfig.password ,ssConfig.cipherName)
    var errorPtr: NSError?
    guard let client = ShadowsocksNewClient(ssConfig, &errorPtr) else {
        if let error = errorPtr {
            throw error
        }
        throw NSError(
            domain: "OutlinePacketTunnel", code: 1, userInfo: [ NSLocalizedDescriptionKey: "got no client and no error from ShadowsocksNewClient"])
    }
    return client
}

func newOutlineDevice(transportConfig: [String: Any]) async throws -> OutlineDevice {
    let goClient = try newGoClient(transportConfig)
    
    var errorInt = ErrorCode.noError.rawValue
    var connectivityError: NSError?
    // TODO(fortuna): Should we run this on a separate thread?
    // TODO: move the check to the OutlineDevice.
    ShadowsocksCheckConnectivity(goClient, &errorInt, &connectivityError)
    let errorCode = ErrorCode(rawValue: errorInt)
    let tcpOk = (errorCode == ErrorCode.noError ||
                 errorCode == ErrorCode.udpRelayNotEnabled)
    let udpOk = errorCode == ErrorCode.noError
    os_log(.info, log: log, "Connectivity Result: errorCode: %{public}d, error: %{public}@, tcp: %{public}@, udp: %{public}@", errorInt, String(describing: connectivityError), String(describing: tcpOk), String(describing: udpOk))
    guard tcpOk else {
        throw NEVPNError(.connectionFailed)
    }
    return OutlineDevice(client: goClient, isUdpEnabled: udpOk)
}

private func makeTunWriter(_ packetFlow: NEPacketTunnelFlow) -> Tun2socksTunWriter {
    // TODO: implement
    return Tun2socksTunWriter()
}

// MARK: - Settings functions

// Helper function that we can call from Objective-C.
func getTunnelNetworkSettings(tunnelRemoteAddress: String) -> NEPacketTunnelNetworkSettings {
    // The remote address is not used for routing, but for display in Settings > VPN > Outline.
    let settings = NEPacketTunnelNetworkSettings(tunnelRemoteAddress: tunnelRemoteAddress)
    
    // Configure VPN address and routing.
    let vpnAddress = selectVpnAddress(interfaceAddresses: getNetworkInterfaceAddresses())
    // The addresses will show up in the profile details when the VPN is active.
    let ipv4Settings = NEIPv4Settings(addresses: [vpnAddress], subnetMasks: ["255.255.255.0"])
    ipv4Settings.includedRoutes = [NEIPv4Route.default()]
    ipv4Settings.excludedRoutes = getExcludedIpv4Routes()
    settings.ipv4Settings = ipv4Settings
    
    // Configure with Cloudflare, Quad9, and OpenDNS resolver addresses.
    settings.dnsSettings = NEDNSSettings(servers: ["1.1.1.1", "9.9.9.9", "208.67.222.222", "208.67.220.220"])
    
    return settings
}

// Returns all IPv4 addresses of all interfaces.
func getNetworkInterfaceAddresses() -> [String] {
    var interfaces: UnsafeMutablePointer<ifaddrs>?
    var addresses = [String]()
    
    guard getifaddrs(&interfaces) == 0 else {
        os_log(.error, log:log, "Failed to retrieve network interface addresses")
        return addresses
    }
    
    var interface = interfaces
    while interface != nil {
        // Only consider IPv4 interfaces.
        if interface!.pointee.ifa_addr.pointee.sa_family == UInt8(AF_INET) {
            let addr = interface!.pointee.ifa_addr!.withMemoryRebound(to: sockaddr_in.self, capacity: 1) { $0.pointee.sin_addr }
            if let ip = String(cString: inet_ntoa(addr), encoding: .utf8) {
                addresses.append(ip)
            }
        }
        interface = interface!.pointee.ifa_next
    }
    
    freeifaddrs(interfaces)
    
    return addresses
}

let kVpnSubnetCandidates: [String: String] = [
    "10": "10.111.222.0",
    "172": "172.16.9.1",
    "192": "192.168.20.1",
    "169": "169.254.19.0"
]

// Given the list of known interface addresses, returns a local network IP address to use for the VPN.
func selectVpnAddress(interfaceAddresses: [String]) -> String {
    var candidates = kVpnSubnetCandidates
    
    for address in interfaceAddresses {
        for subnetPrefix in kVpnSubnetCandidates.keys {
            if address.hasPrefix(subnetPrefix) {
                // The subnet (not necessarily the address) is in use, remove it from our list.
                candidates.removeValue(forKey: subnetPrefix)
            }
        }
    }
    guard !candidates.isEmpty else {
        // Even though there is an interface bound to the subnet candidates, the collision probability
        // with an actual address is low.
        return kVpnSubnetCandidates.randomElement()!.value
    }
    // Select a random subnet from the remaining candidates.
    return candidates.randomElement()!.value
}

let kExcludedSubnets = [
    "10.0.0.0/8",
    "100.64.0.0/10",
    "169.254.0.0/16",
    "172.16.0.0/12",
    "192.0.0.0/24",
    "192.0.2.0/24",
    "192.31.196.0/24",
    "192.52.193.0/24",
    "192.88.99.0/24",
    "192.168.0.0/16",
    "192.175.48.0/24",
    "198.18.0.0/15",
    "198.51.100.0/24",
    "203.0.113.0/24",
    "240.0.0.0/4"
]

func getExcludedIpv4Routes() -> [NEIPv4Route] {
    var excludedIpv4Routes = [NEIPv4Route]()
    for cidrSubnet in kExcludedSubnets {
        if let subnet = Subnet.parse(cidrSubnet) {
            let route = NEIPv4Route(destinationAddress: subnet.address, subnetMask: subnet.mask)
            excludedIpv4Routes.append(route)
        }
    }
    return excludedIpv4Routes
}

