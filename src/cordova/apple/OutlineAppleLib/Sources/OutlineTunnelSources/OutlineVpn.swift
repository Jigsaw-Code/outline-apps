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
import Tun2socks

// Manages the system's VPN tunnel through the VpnExtension process.
@objcMembers
public class OutlineVpn: NSObject {
  public static let shared = OutlineVpn()
  private static let kVpnExtensionBundleId = "\(Bundle.main.bundleIdentifier!).VpnExtension"

  public typealias Callback = (ErrorCode) -> Void
  public typealias VpnStatusObserver = (NEVPNStatus, String) -> Void

  public private(set) var activeTunnelId: String?
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

  // This must be kept in sync with:
  //  - cordova-plugin-outline/apple/vpn/PacketTunnelProvider.h#NS_ENUM
  //  - www/model/errors.ts
  @objc
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

  override private init() {
    super.init()
    getTunnelManager() { manager in
      guard manager != nil else {
        return DDLogInfo("Tunnel manager not active. VPN not configured.")
      }
      self.tunnelManager = manager!
      self.observeVpnStatusChange(self.tunnelManager!)
      if self.isVpnConnected() {
        self.retrieveActiveTunnelId()
      }
    }
  }

  // MARK: Interface

  // Starts a VPN tunnel as specified in the OutlineTunnel object.
  public func start(_ tunnelId: String, configJson: [String: Any], _ completion: @escaping (Callback)) {
    guard !isActive(tunnelId) else {
      return completion(ErrorCode.noError)
    }
    if isVpnConnected() {
      return restartVpn(tunnelId, configJson: configJson, completion: completion)
    }
    self.startVpn(tunnelId, configJson: configJson, isAutoConnect: false, completion)
  }

  // Starts the last successful VPN tunnel.
  @objc public func startLastSuccessfulTunnel(_ completion: @escaping (Callback)) {
    // Explicitly pass an empty tunnel's configuration, so the VpnExtension process retrieves
    // the last configuration from disk.
    self.startVpn(nil, configJson:nil, isAutoConnect: true, completion)
  }

  // Tears down the VPN if the tunnel with id |tunnelId| is active.
  public func stop(_ tunnelId: String) {
    if !isActive(tunnelId) {
      return DDLogWarn("Cannot stop VPN, tunnel ID \(tunnelId)")
    }
    stopVpn()
  }

  // Calls |observer| when the VPN's status changes.
  public func onVpnStatusChange(_ observer: @escaping(VpnStatusObserver)) {
    vpnStatusObserver = observer
  }

  // Returns whether |tunnelId| is actively proxying through the VPN.
  public func isActive(_ tunnelId: String?) -> Bool {
    if self.activeTunnelId == nil {
      return false
    }
    return self.activeTunnelId == tunnelId && isVpnConnected()
  }

  // MARK: Helpers

  private func startVpn(_ tunnelId: String?, configJson: [String: Any]?, isAutoConnect: Bool, _ completion: @escaping(Callback)) {
    setupVpn() { error in
      if error != nil {
        DDLogError("Failed to setup VPN: \(String(describing: error))")
        return completion(ErrorCode.vpnPermissionNotGranted);
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
        completion(ErrorCode.vpnStartFailure)
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
        self.observeVpnStatusChange(manager!)
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

  // Retrieves the application's tunnel provider manager from the VPN preferences.
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

  // Retrieves the active tunnel ID from the VPN extension.
  private func retrieveActiveTunnelId() {
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

  // Returns whether the VPN is connected or (re)connecting by querying |tunnelManager|.
  private func isVpnConnected() -> Bool {
    if tunnelManager == nil {
      return false
    }
    let vpnStatus = tunnelManager?.connection.status
    return vpnStatus == .connected || vpnStatus == .connecting || vpnStatus == .reasserting
  }

  // Listen for changes in the VPN status.
  private func observeVpnStatusChange(_ manager: NETunnelProviderManager) {
    // Remove self to guard against receiving duplicate notifications due to page reloads.
    NotificationCenter.default.removeObserver(self, name: .NEVPNStatusDidChange,
                                              object: manager.connection)
    NotificationCenter.default.addObserver(self, selector: #selector(self.vpnStatusChanged),
                                           name: .NEVPNStatusDidChange, object: manager.connection)
  }

  // Receives NEVPNStatusDidChange notifications. Calls onTunnelStatusChange for the active
  // tunnel.
  func vpnStatusChanged() {
    if let vpnStatus = tunnelManager?.connection.status {
      if let tunnelId = activeTunnelId {
        if (vpnStatus == .disconnected) {
          activeTunnelId = nil
        }
        vpnStatusObserver?(vpnStatus, tunnelId)
      } else if vpnStatus == .connected {
        // The VPN was connected from the settings app while the UI was in the background.
        // Retrieve the tunnel ID to update the UI.
        retrieveActiveTunnelId()
      }
    }
  }

  // MARK: VPN extension IPC

  /**
   Sends a message to the VPN extension if the VPN has been setup. Sets a
   callback to be invoked by the extension once the message has been processed.
   */
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
      return completion(ErrorCode.vpnStartFailure)
    }
    let rawErrorCode = response[MessageKey.errorCode] as? Int ?? ErrorCode.undefined.rawValue
    if rawErrorCode == ErrorCode.noError.rawValue,
       let tunnelId = response[MessageKey.tunnelId] as? String {
      self.activeTunnelId = tunnelId
      // Enable on demand to connect automatically on boot if the VPN was connected on shutdown
      self.setConnectVpnOnDemand(true)
    }
    completion(ErrorCode(rawValue: rawErrorCode) ?? ErrorCode.noError)
  }

}

