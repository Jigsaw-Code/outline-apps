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

// Manages the system's VPN tunnel through the VpnExtension process.
@objcMembers
public class OutlineVpn: NSObject {
  public static let shared = OutlineVpn()
  private static let kVpnExtensionBundleId = "\(Bundle.main.bundleIdentifier!).VpnExtension"

  public typealias Callback = (String?) -> Void
  public typealias VpnStatusObserver = (NEVPNStatus, String) -> Void

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
    static let error = "error"
    static let host = "host"
    static let port = "port"
    static let isOnDemand = "is-on-demand"
  }

  override private init() {
    super.init()

    // Register observer for VPN changes.
    // Remove self to guard against receiving duplicate notifications due to page reloads.
    NotificationCenter.default.removeObserver(self, name: .NEVPNStatusDidChange, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(self.vpnStatusChanged),
                                           name: .NEVPNStatusDidChange, object: nil)

    getTunnelManager() { manager in
      guard manager != nil else {
        return DDLogInfo("Tunnel manager not active. VPN not configured.")
      }
      if (isActiveSession(manager?.connection)) {
        self.tunnelManager = manager
      }
    }
  }

  // MARK: Interface

  // Starts a VPN tunnel as specified in the OutlineTunnel object.
  public func start(_ tunnelId: String, name: String?, configJson: [String: Any], _ completion: @escaping (Callback)) {
    Task {
      if isActiveSession(self.tunnelManager?.connection) {
        if getTunnelId(forManager: self.tunnelManager) == tunnelId {
          return completion("")
        } else {
          await self.stopActiveVpn()
        }
      }
      self.startVpn(tunnelId, withName: name, configJson: configJson, isAutoConnect: false, completion)
    }
  }

  // Starts the last successful VPN tunnel.
  @objc public func startLastSuccessfulTunnel(_ completion: @escaping (Callback)) {
    // Explicitly pass an empty tunnel's configuration, so the VpnExtension process retrieves
    // the last configuration from disk.
    getTunnelManager() { manager in
      guard manager != nil,
            let tunnelId = getTunnelId(forManager: manager) else {
        DDLogInfo("Tunnel manager not setup")
        completion(ErrorCode.illegalServerConfiguration)
        return
      }
      self.startVpn(tunnelId, withName: manager?.localizedDescription, configJson:nil, isAutoConnect: true, completion)
    }
  }

  // Tears down the VPN if the tunnel with id |tunnelId| is active.
  public func stop(_ tunnelId: String) async {
    if !isActive(tunnelId) {
      return DDLogWarn("Cannot stop VPN, tunnel ID \(tunnelId)")
    }
    await self.stopActiveVpn()
  }

  // Calls |observer| when the VPN's status changes.
  public func onVpnStatusChange(_ observer: @escaping(VpnStatusObserver)) {
    vpnStatusObserver = observer
  }

  // Returns whether |tunnelId| is actively proxying through the VPN.
  public func isActive(_ tunnelId: String?) -> Bool {
    guard let manager = self.tunnelManager, tunnelId != nil else {
      return false
    }
    return getTunnelId(forManager: manager) == tunnelId && isVpnConnected()
  }

  // MARK: Helpers

  private func startVpn(_ tunnelId: String, withName optionalName: String?, configJson: [String: Any]?, isAutoConnect: Bool, _ completion: @escaping(Callback)) {
    // TODO(fortuna): Use localized name.
    setupVpn(withId: tunnelId, withName: optionalName ?? "Outline Server") { error in
      if error != nil {
        DDLogError("Failed to setup VPN: \(String(describing: error))")
        return completion("VPN permission is not granted");
      }
      let message = [MessageKey.action: Action.start, MessageKey.tunnelId: tunnelId];
      self.sendVpnExtensionMessage(message) { response in
        // Do nothing. We already handle the VPN events directly.
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
      } catch let error as NSError {
        DDLogError("Failed to start VPN: \(error)")
        completion(error.localizedDescription)
      }
    }
  }

  public func stopActiveVpn() async {
    guard let manager = self.tunnelManager else {
      return
    }
    do {
      try await manager.loadFromPreferences()
      await setConnectVpnOnDemand(manager, false) // Disable on demand so the VPN does not connect automatically.
      manager.connection.stopVPNTunnel()
      // Wait for stop to be completed.
      class TokenHolder {
          var token: NSObjectProtocol?
      }
      let tokenHolder = TokenHolder()
      await withCheckedContinuation { continuation in
          tokenHolder.token = NotificationCenter.default.addObserver(forName: .NEVPNStatusDidChange, object: manager.connection, queue: nil) { notification in
              if manager.connection.status == .disconnected {
                  DDLogDebug("Tunnel stopped. Ready to start again.")
                if let token = tokenHolder.token {
                    NotificationCenter.default.removeObserver(token, name: .NEVPNStatusDidChange, object: manager.connection)
                }
                continuation.resume()
              }
          }
      }
    } catch {
      DDLogWarn("Failed to stop VPN")
    }
  }

  // Adds a VPN configuration to the user preferences if no Outline profile is present. Otherwise
  // enables the existing configuration.
  private func setupVpn(withId id:String, withName name:String, completion: @escaping(Error?) -> Void) {
    NETunnelProviderManager.loadAllFromPreferences() { (managers, error) in
      if let error = error {
        DDLogError("Failed to load VPN configuration: \(error)")
        return completion(error)
      }
      var manager: NETunnelProviderManager!
      if let managers = managers, managers.count > 0 {
        manager = managers.first
      } else {
        manager = NETunnelProviderManager()
      }

      let config = NETunnelProviderProtocol()
      // TODO(fortuna): set to something meaningful if we can.
      config.serverAddress = "Outline"
      config.providerBundleIdentifier = OutlineVpn.kVpnExtensionBundleId
      config.providerConfiguration = ["id": id]

      manager.localizedDescription = name
      manager.protocolConfiguration = config

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
        self.tunnelManager = manager
        NotificationCenter.default.post(name: .NEVPNConfigurationChange, object: nil)
        // Workaround for https://forums.developer.apple.com/thread/25928
        self.tunnelManager?.loadFromPreferences() { error in
          completion(error)
        }
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

  // Returns whether the VPN is connected or (re)connecting by querying |tunnelManager|.
  private func isVpnConnected() -> Bool {
    if tunnelManager == nil {
      return false
    }
    let vpnStatus = tunnelManager?.connection.status
    return vpnStatus == .connected || vpnStatus == .connecting || vpnStatus == .reasserting
  }

  // Receives NEVPNStatusDidChange notifications. Calls onTunnelStatusChange for the active
  // tunnel.
  func vpnStatusChanged(notification: NSNotification) {
    guard let session = notification.object as? NETunnelProviderSession,
          let manager = session.manager as? NETunnelProviderManager else {
      DDLogDebug("Bad manager in OutlineVpn.vpnStatusChanged")
      return
    }
    guard let protoConfig = manager.protocolConfiguration as? NETunnelProviderProtocol,
          let tunnelId = protoConfig.providerConfiguration?["id"] as? String else {
      DDLogWarn("Bad VPN Config: \(String(describing: session.manager.protocolConfiguration))")
      return
    }
    DDLogDebug("OutlineVpn received status change for \(tunnelId): \(String(describing: session.status))")
    if isActiveSession(session) {
      self.tunnelManager = manager
      Task {
        await setConnectVpnOnDemand(manager, true)
      }
    } else if session.status == .disconnected {
      self.tunnelManager = nil
    }
    self.vpnStatusObserver?(session.status, tunnelId)
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
}

private func getTunnelId(forManager manager:NETunnelProviderManager?) -> String? {
  let protoConfig = manager?.protocolConfiguration as? NETunnelProviderProtocol
  return protoConfig?.providerConfiguration?["id"] as? String
}

private func isActiveSession(_ session: NEVPNConnection?) -> Bool {
  let vpnStatus = session?.status
  return vpnStatus == .connected || vpnStatus == .connecting || vpnStatus == .reasserting
}

private func setConnectVpnOnDemand(_ manager: NETunnelProviderManager?, _ enabled: Bool) async {
  do {
    try await manager?.loadFromPreferences()
    manager?.isOnDemandEnabled = enabled
    try await manager?.saveToPreferences()
  } catch {
    DDLogError("Failed to set VPN on demand to \(enabled): \(error)")
    return
  }
}
