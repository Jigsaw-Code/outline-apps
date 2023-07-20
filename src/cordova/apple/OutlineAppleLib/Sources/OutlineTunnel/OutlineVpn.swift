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

import CocoaLumberjackSwift
import NetworkExtension

import OutlinePacketTunnel
import Tun2socks

// TODO:
// - fix moving from one to another. Log status notifications.
// - mutex for getting manager. Actors?
// - add relay
// - cleanup
// - handle state from the start

// Manages the system's VPN tunnel through the VpnExtension process.
public class OutlineVpn: NSObject {
    public static let shared = OutlineVpn()
    private static let kVpnExtensionBundleId = "\(Bundle.main.bundleIdentifier!).VpnExtension"
    
    public typealias Callback = (OutlinePacketTunnel.ErrorCode) -> Void
    public typealias VpnStatusObserver = (NEVPNStatus, String) -> Void
    
//    public private(set) var activeTunnelId: String?
    private var tunnelManager: NETunnelProviderManager?
    private var vpnStatusObserver: VpnStatusObserver?
    
    private enum Action {
        static let start = "start"
        static let restart = "restart"
        static let stop = "stop"
        static let getTunnelId = "getTunnelId"
    }
    
    private enum MessageKey {
        static let action = "action"
        static let tunnelId = "tunnelId"
        static let config = "config"
        static let errorCode = "errorCode"
        static let host = "host"
        static let port = "port"
        static let isOnDemand = "is-on-demand"
    }
       
    override private init() {
        // Set up observer
//        super.init()
//        getTunnelManager() { manager in
//            guard manager != nil else {
//                return DDLogInfo("Tunnel manager not active. VPN not configured.")
//            }
//            self.tunnelManager = manager!
//            self.observeVpnStatusChange(self.tunnelManager!)
//            if self.isVpnConnected() {
//                self.retrieveActiveTunnelId()
//            }
//        }
    }
    
    // MARK: Plugin Interface
    
    // Starts a VPN tunnel as specified in the OutlineTunnel object.
    public func start(_ tunnelId: String, configJson: [String: Any], _ completion: @escaping (Callback)) {
        // TODO(fortuna): Pass the service name in the start call instead.
        let serviceName = configJson["host"] as? String ?? "Outline Server"
        Task {
            completion(await self.startTunnel(tunnelId, name: serviceName, config: configJson))
        }
    }
    
    private func startTunnel(_ tunnelId: String, name serviceName: String, config configJson: [String: Any]) async -> OutlinePacketTunnel.ErrorCode {
        DDLogInfo("OutlineVpn.start called for tunnel \(tunnelId)")
        
        if self.isVpnConnected() {
            if (OutlineVpn.getTunnelId(manager: self.tunnelManager) == tunnelId) {
                DDLogInfo("VPN already running. Returning.")
                return ErrorCode.noError
            }
            DDLogInfo("Stopping previous tunnel.")
            self.stopTunnel(fromManager: self.tunnelManager)
        }

        // Get and configure manager.
        let manager : NETunnelProviderManager
        do {
            manager = try await self.getTunnelManager()
            try await OutlineVpn.configureService(manager: manager, id: tunnelId, name: serviceName, config: configJson)
        } catch {
            DDLogError("Failed to set up VPN: \(error)")
            return ErrorCode.vpnPermissionNotGranted
        }
        DDLogInfo("Configured tunnel \(tunnelId) with manager \(String(describing: self.tunnelManager))")
        
        // Start tunnel.
        DDLogInfo("Enabling VPN")
        manager.isEnabled = true
        do {
            DDLogInfo("Calling connection.startVPNTunnel")
            // TODO: pass an option to make connectivity failure fatal.
            try manager.connection.startVPNTunnel(options:[:])
            // TODO: wait for the start to be complete
        } catch {
            DDLogError("Failed to start VPN tunnel: \(error)")
            return ErrorCode.vpnStartFailure
        }
        
        return ErrorCode.noError
    }
    
    
    // Tears down the VPN if the tunnel with id |tunnelId| is active.
    public func stopTunnel(withId tunnelId: String) {
        let activeTunnelId = OutlineVpn.getTunnelId(manager: self.tunnelManager)
        DDLogInfo("OutlineVpn.stop called for tunnel \(tunnelId). Active tunnel has id \(activeTunnelId) and manager \(self.tunnelManager)")
        guard tunnelId == activeTunnelId else {
            DDLogInfo("OutlineVpn.stop requested for tunnel \(tunnelId), but it's not active")
            return
        }
        self.stopTunnel(fromManager: self.tunnelManager)
    }
    
    private func stopTunnel(fromManager manager: NETunnelProviderManager?) {
        guard let manager = manager else {
            DDLogInfo("OutlineVpn.stop requested, but there's no active manager")
            return
        }
        let tunnelId = OutlineVpn.getTunnelId(manager: manager)
        manager.isOnDemandEnabled = false
        manager.saveToPreferences() { error in
            if let error = error {
                DDLogError("Failed to save isOnDemandEnabled = false: \(error). You may need to manually disable it in Settings > VPN.")
            }
            manager.connection.stopVPNTunnel()
            if tunnelId != nil {
                self.vpnStatusObserver?(.disconnected, tunnelId!)
            }
        }
    }
    
    public func shutdown() {
        self.stopTunnel(fromManager: self.tunnelManager)
    }
    
    // Calls |observer| when the VPN's status changes.
    public func onVpnStatusChange(_ observer: @escaping(VpnStatusObserver)) {
        vpnStatusObserver = observer
    }
    
    // Returns whether |tunnelId| is actively proxying through the VPN.
    public func isActive(_ tunnelId: String) -> Bool {
        let activeTunnelId = OutlineVpn.getTunnelId(manager: self.tunnelManager)
        return tunnelId == activeTunnelId && isVpnConnected()
    }
    
    // MARK: Helpers
    private static func getTunnelId(manager: NETunnelProviderManager?) -> String? {
        return (manager?.protocolConfiguration as? NETunnelProviderProtocol)?.providerConfiguration?[OutlinePacketTunnel.ConfigKeys.tunnelId.rawValue] as? String
    }
    
    // TODO: Protect this with mutext
    private static func getFirstTunnelProviderManager() async throws -> NETunnelProviderManager {
        if let manager = try await NETunnelProviderManager.loadAllFromPreferences().first {
            DDLogInfo("OutlineVpn.getOutlineTunnelProviderManager found a manager")
            return manager
        } else {
            DDLogInfo("OutlineVpn.getOutlineTunnelProviderManager didn't find a manager. Creating")
            return NETunnelProviderManager()
        }
    }
    
    private static func configureService(manager: NETunnelProviderManager, id tunnelId: String, name serviceName: String, config configJson: [String: Any]) async throws {
        // This is the title of the VPN configuration entry. The subtitle will be the container app name.
        manager.localizedDescription = serviceName
        
        // Set an on-demand rule to connect to any available network to implement auto-connect on boot
        let onDemandRule = NEOnDemandRuleConnect()
        onDemandRule.interfaceTypeMatch = .any
        manager.onDemandRules = [onDemandRule]
        manager.isOnDemandEnabled = true

        let config = NETunnelProviderProtocol()
        config.providerBundleIdentifier = OutlineVpn.kVpnExtensionBundleId
        
        // This shows as "Server address" in the details of the profile.
        config.serverAddress = serviceName
        
        if #available(macOS 13.3, iOS 11, *) {
            config.excludeAPNs = false
            config.excludeCellularServices = false
        }
        config.excludeLocalNetworks = true
        config.providerConfiguration = [
            OutlinePacketTunnel.ConfigKeys.tunnelId.rawValue: tunnelId,
            OutlinePacketTunnel.ConfigKeys.transport.rawValue: configJson
        ]
        manager.protocolConfiguration = config
        
        try await manager.saveToPreferences()
        // Workaround for https://forums.developer.apple.com/thread/25928
        try await manager.loadFromPreferences()
    }
    
    private func getTunnelManager() async throws -> NETunnelProviderManager {
        if let manager = self.tunnelManager {
            return manager
        }
        let manager = try await OutlineVpn.getFirstTunnelProviderManager()
        self.tunnelManager = manager
        self.observeVpnStatusChange(of: manager.connection)
        return manager
    }
    
    /*
    private func startVpn(_ tunnelId: String?, configJson: [String: Any]?, isAutoConnect: Bool, _ completion: @escaping(Callback)) {
        setupVpn() { error in
            if error != nil {
                DDLogError("Failed to setup VPN: \(String(describing: error))")
                return completion(OutlinePacketTunnel.ErrorCode.vpnPermissionNotGranted);
            }
            let message = [MessageKey.action: Action.start, MessageKey.tunnelId: tunnelId ?? ""];
            self.sendVpnExtensionMessage(message) { response in
                self.onStartVpnExtensionMessage(response, completion: completion)
            }
            var tunnelOptions: [String: Any]? = nil
            if !isAutoConnect {
                // TODO(fortuna): put this in a subkey
                tunnelOptions = configJson
                tunnelOptions?[MessageKey.tunnelId] = tunnelId
            } else {
                // macOS app was started by launcher.
                tunnelOptions = [MessageKey.isOnDemand: "true"];
            }
            let session = self.tunnelManager?.connection as! NETunnelProviderSession
            do {
                try session.startTunnel(options: tunnelOptions)
            } catch let error as NSError  {
                DDLogError("Failed to start VPN: \(error)")
                completion(OutlinePacketTunnel.ErrorCode.vpnStartFailure)
            }
        }
    }
    
    private func stopVpn() {
        let session: NETunnelProviderSession = tunnelManager?.connection as! NETunnelProviderSession
        session.stopTunnel()
        setConnectVpnOnDemand(false) // Disable on demand so the VPN does not connect automatically.
        self.activeTunnelId = nil
    }
    
    // Sends message to extension to restart the tunnel without tearing down the VPN.
    private func restartVpn(_ tunnelId: String, configJson: [String: Any],
                            completion: @escaping(Callback)) {
        if activeTunnelId != nil {
            vpnStatusObserver?(.disconnected, activeTunnelId!)
        }
        let message = [MessageKey.action: Action.restart, MessageKey.tunnelId: tunnelId,
                       MessageKey.config: configJson] as [String : Any]
        self.sendVpnExtensionMessage(message) { response in
            self.onStartVpnExtensionMessage(response, completion: completion)
        }
    }
     */
    
    // Adds a VPN configuration to the user preferences if no Outline profile is present. Otherwise
    // enables the existing configuration.
    private func setupVpn(completion: @escaping(Error?) -> Void) {
        NETunnelProviderManager.loadAllFromPreferences() { (managers, error) in
            if let error = error {
                DDLogError("Failed to load VPN configuration: \(error)")
                return completion(error)
            }
            var manager: NETunnelProviderManager!
            if let managers = managers, managers.count > 0 {
                manager = managers.first
                let hasOnDemandRules = !(manager.onDemandRules?.isEmpty ?? true)
                if manager.isEnabled && hasOnDemandRules {
                    self.tunnelManager = manager
                    return completion(nil)
                }
            } else {
                let config = NETunnelProviderProtocol()
                config.providerBundleIdentifier = OutlineVpn.kVpnExtensionBundleId
                config.serverAddress = "Outline"
                
                manager = NETunnelProviderManager()
                manager.protocolConfiguration = config
            }
            // Set an on-demand rule to connect to any available network to implement auto-connect on boot
            let connectRule = NEOnDemandRuleConnect()
            connectRule.interfaceTypeMatch = .any
            manager.onDemandRules = [connectRule]
            manager.isEnabled = true
            manager.saveToPreferences() { error in
                if let error = error {
                    DDLogError("Failed to save VPN configuration: \(error)")
                    return completion(error)
                }
                self.observeVpnStatusChange(of: manager.connection)
                self.tunnelManager = manager
                NotificationCenter.default.post(name: .NEVPNConfigurationChange, object: nil)
                // Workaround for https://forums.developer.apple.com/thread/25928
                self.tunnelManager?.loadFromPreferences() { error in
                    completion(error)
                }
            }
        }
    }
    
    private func setConnectVpnOnDemand(_ enabled: Bool) {
        self.tunnelManager?.isOnDemandEnabled = enabled
        self.tunnelManager?.saveToPreferences { error  in
            if let error = error {
                return DDLogError("Failed to set VPN on demand to \(enabled): \(error)")
            }
        }
    }
    
    /// Retrieves the application's tunnel provider manager from the VPN preferences.
    private func getTunnelManager(_ completion: @escaping ((NETunnelProviderManager?) -> Void)) {
        NETunnelProviderManager.loadAllFromPreferences() { (managers, error) in
            guard error == nil, managers != nil else {
                completion(nil)
                return DDLogError("Failed to get tunnel manager: \(String(describing: error))")
            }
            var manager: NETunnelProviderManager?
            if managers!.count > 0 {
                manager = managers!.first
            }
            completion(manager)
        }
    }
    
    /*
    /// Retrieves the active tunnel ID from the VPN extension.
    private func retrieveActiveTunnelId() {
        // TODO(fortuna): Get the tunnel id from the running configuration.
        if tunnelManager == nil {
            return
        }
        self.sendVpnExtensionMessage([MessageKey.action: Action.getTunnelId]) { response in
            guard response != nil else {
                return DDLogError("Failed to retrieve the active tunnel ID")
            }
            guard let activeTunnelId = response?[MessageKey.tunnelId] as? String else {
                return DDLogError("Failed to retrieve the active tunnel ID")
            }
            DDLogInfo("Got active tunnel ID: \(activeTunnelId)")
            self.activeTunnelId = activeTunnelId
            self.vpnStatusObserver?(.connected, self.activeTunnelId!)
        }
    }
     */
    
    /// Returns whether the VPN is connected or (re)connecting by querying |tunnelManager|.
    private func isVpnConnected() -> Bool {
        guard let tunnelManager = self.tunnelManager else {
            return false
        }
        let vpnStatus = tunnelManager.connection.status
        return vpnStatus == .connected || vpnStatus == .connecting || vpnStatus == .reasserting
    }
    
    /// Listen for changes in the VPN status.
    private func observeVpnStatusChange(of connection: NEVPNConnection) {
        // Remove self to guard against receiving duplicate notifications due to page reloads.
        NotificationCenter.default.removeObserver(self, name: .NEVPNStatusDidChange,
                                                  object: connection)
        NotificationCenter.default.addObserver(self, selector: #selector(self.vpnStatusChanged),
                                               name: .NEVPNStatusDidChange, object: connection)
    }
    
    // Receives NEVPNStatusDidChange notifications. Calls onTunnelStatusChange for the active
    // tunnel.
    @objc func vpnStatusChanged() {
        guard let manager = self.tunnelManager,
              let tunnelId = OutlineVpn.getTunnelId(manager: self.tunnelManager) else {
            return
        }
        self.vpnStatusObserver?(manager.connection.status, tunnelId)
    }
    
    // MARK: - OLD CODE
    
    
    // MARK: VPN extension IPC
    
    /**
     Sends a message to the VPN extension if the VPN has been setup. Sets a
     callback to be invoked by the extension once the message has been processed.
     */
    /*
    private func sendVpnExtensionMessage(_ message: [String: Any],
                                         callback: @escaping (([String: Any]?) -> Void)) {
        if tunnelManager == nil {
            return DDLogError("Cannot set an extension callback without a tunnel manager")
        }
        var data: Data
        do {
            data = try JSONSerialization.data(withJSONObject: message, options: [])
        } catch {
            return DDLogError("Failed to serialize message to VpnExtension as JSON")
        }
        let completionHandler: (Data?) -> Void = { data in
            guard let responseData = data else {
                return callback(nil)
            }
            do {
                if let response = try JSONSerialization.jsonObject(with: responseData,
                                                                   options: []) as? [String: Any] {
                    DDLogInfo("Received extension message: \(String(describing: response))")
                    return callback(response)
                }
            } catch {
                DDLogError("Failed to deserialize the VpnExtension response")
            }
            callback(nil)
        }
        let session: NETunnelProviderSession = tunnelManager?.connection as! NETunnelProviderSession
        do {
            try session.sendProviderMessage(data, responseHandler: completionHandler)
        } catch {
            DDLogError("Failed to send message to VpnExtension")
        }
    }
    
    func onStartVpnExtensionMessage(_ message: [String:Any]?, completion: Callback) {
        guard let response = message else {
            return completion(OutlinePacketTunnel.ErrorCode.vpnStartFailure)
        }
        let rawErrorCode = response[MessageKey.errorCode] as? Int ?? ErrorCode.undefined.rawValue
        if rawErrorCode == OutlinePacketTunnel.ErrorCode.noError.rawValue,
           let tunnelId = response[MessageKey.tunnelId] as? String {
            self.activeTunnelId = tunnelId
            // Enable on demand to connect automatically on boot if the VPN was connected on shutdown
            self.setConnectVpnOnDemand(true)
        }
        completion(OutlinePacketTunnel.ErrorCode(rawValue: rawErrorCode) ?? ErrorCode.noError)
    }
    */
}

