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

  public typealias Callback = (ErrorCode) -> Void
  public typealias VpnStatusObserver = (NEVPNStatus, String) -> Void

  private var vpnStatusObserver: VpnStatusObserver?

  private enum Action {
    static let start = "start"
    static let restart = "restart"
    static let stop = "stop"
    static let getTunnelId = "getTunnelId"
  }

  private enum ConfigKey {
    static let tunnelId = "id"
    static let transport = "transport"
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
    // Register observer for VPN changes.
    // Remove self to guard against receiving duplicate notifications due to page reloads.
    NotificationCenter.default.removeObserver(self, name: .NEVPNStatusDidChange, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(self.vpnStatusChanged),
                                           name: .NEVPNStatusDidChange, object: nil)
  }

  // MARK: Interface

  /** Starts a VPN tunnel as specified in the OutlineTunnel object. */
  public func start(_ tunnelId: String, name: String?, transportConfig: [String: Any]) async -> ErrorCode {
    if let manager = await getTunnelManager(), isActiveSession(manager.connection) {
      DDLogDebug("Stoppping active session before starting new one")
      await stopSession(manager)
    }

    let manager: NETunnelProviderManager
    do {
      manager = try await setupVpn(withId: tunnelId, named: name ?? "Outline Server", withTransport: transportConfig)
    } catch {
      DDLogError("Failed to setup VPN: \(error.localizedDescription))")
      return ErrorCode.vpnPermissionNotGranted;
    }
    let session = manager.connection as! NETunnelProviderSession

    // Register observer for start process completion.
    class TokenHolder {
      var token: NSObjectProtocol?
    }
    let tokenHolder = TokenHolder()
    let startDone = Task {
      await withCheckedContinuation { continuation in
        tokenHolder.token = NotificationCenter.default.addObserver(forName: .NEVPNStatusDidChange, object: manager.connection, queue: nil) { notification in
          DDLogDebug("OutlineVpn.start got status \(String(describing: session.status)), notification: \(String(describing: notification))")

          let status = manager.connection.status
          // The observer may be triggered multiple times, but we only remove it when we reach an end state.
          // A successful connection will go through .connecting -> .disconnected
          // A failed connection will go through .connecting -> .disconnecting -> .disconnected
          // An .invalid event may happen if the configuration is modified and ends in an invalid state.
          if status == .connected || status == .disconnected || status == .invalid {
            DDLogDebug("Tunnel start done.")
            if let token = tokenHolder.token {
              NotificationCenter.default.removeObserver(token, name: .NEVPNStatusDidChange, object: manager.connection)
            }
            continuation.resume()
          }
        }
      }
    }

    // Start the session.
    do {
      DDLogDebug("Calling NETunnelProviderSession.startTunnel([:])")
      try session.startTunnel(options: [:])
      DDLogDebug("NETunnelProviderSession.startTunnel() returned")
    } catch let error as NSError  {
      DDLogError("Failed to start VPN: \(error.localizedDescription)")
      return ErrorCode.vpnStartFailure
    }

    // Wait for it to be done.
    await startDone.value

    switch manager.connection.status {
    case .connected:
      break
    case .disconnected:
      return ErrorCode.vpnStartFailure
    case .invalid:
      return ErrorCode.systemMisconfigured
    default:
      // This shouldn't happen.
      return ErrorCode.systemMisconfigured
    }
    //

    // Set an on-demand rule to connect to any available network to implement auto-connect on boot
    do { try await manager.loadFromPreferences() }
    catch {
      DDLogWarn("OutlineVpn.start: Failed to reload preferences: \(error.localizedDescription)")
    }
    let connectRule = NEOnDemandRuleConnect()
    connectRule.interfaceTypeMatch = .any
    manager.onDemandRules = [connectRule]
    do { try await manager.saveToPreferences() }
    catch {
      DDLogWarn("OutlineVpn.start: Failed to save on-demand preference change: \(error.localizedDescription)")
    }
    return ErrorCode.noError
  }

  /** Tears down the VPN if the tunnel with id |tunnelId| is active. */
  public func stop(_ tunnelId: String) async {
    guard let manager = await getTunnelManager(),
          getTunnelId(forManager: manager) == tunnelId,
          isActiveSession(manager.connection) else {
      DDLogWarn("Trying to stop tunnel \(tunnelId) that is not running")
      return
    }
    await stopSession(manager)
  }

  /** Calls |observer| when the VPN's status changes. */
  public func onVpnStatusChange(_ observer: @escaping(VpnStatusObserver)) {
    vpnStatusObserver = observer
  }

  
  /** Returns whether |tunnelId| is actively proxying through the VPN. */
  public func isActive(_ tunnelId: String?) async -> Bool {
    guard tunnelId != nil, let manager = await getTunnelManager() else {
      return false
    }
    return getTunnelId(forManager: manager) == tunnelId && isActiveSession(manager.connection)
  }

  // MARK: Helpers

  public func stopActiveVpn() async {
    if let manager = await getTunnelManager() {
      await stopSession(manager)
    }
  }

  // Adds a VPN configuration to the user preferences if no Outline profile is present. Otherwise
  // enables the existing configuration.
  private func setupVpn(withId id:String, named name:String, withTransport transportConfig: [String: Any]) async throws -> NETunnelProviderManager {
    let managers = try await NETunnelProviderManager.loadAllFromPreferences()
    var manager: NETunnelProviderManager!
    if managers.count > 0 {
      manager = managers.first
    } else {
      manager = NETunnelProviderManager()
    }

    manager.localizedDescription = name
    // Make sure on-demand is disable, so it doesn't retry on start failure.
    manager.onDemandRules = nil

    // Configure the protocol.
    let config = NETunnelProviderProtocol()
    // TODO(fortuna): set to something meaningful if we can.
    config.serverAddress = "Outline"
    config.providerBundleIdentifier = OutlineVpn.kVpnExtensionBundleId
    config.providerConfiguration = [
      ConfigKey.tunnelId: id,
      ConfigKey.transport: transportConfig
    ]
    manager.protocolConfiguration = config

    // A VPN configuration must be enabled before it can be used to bring up a VPN tunnel.
    manager.isEnabled = true

    try await manager.saveToPreferences()
    // Workaround for https://forums.developer.apple.com/thread/25928
    try await manager.loadFromPreferences()
    return manager
  }

  // Receives NEVPNStatusDidChange notifications. Calls onTunnelStatusChange for the active
  // tunnel.
  func vpnStatusChanged(notification: NSNotification) {
    DDLogDebug("OutlineVpn.vpnStatusChanged: \(String(describing: notification))")
    guard let session = notification.object as? NETunnelProviderSession else {
      DDLogDebug("Bad session in OutlineVpn.vpnStatusChanged")
      return
    }
    guard let manager = session.manager as? NETunnelProviderManager else {
      // For some reason we get spurious notifications with connecting and disconnecting states
      DDLogDebug("Bad manager in OutlineVpn.vpnStatusChanged session=\(String(describing:session)) status=\(String(describing: session.status)) manager=\(session.manager)")
      return
    }
    guard let protoConfig = manager.protocolConfiguration as? NETunnelProviderProtocol,
          let tunnelId = protoConfig.providerConfiguration?["id"] as? String else {
      DDLogWarn("Bad VPN Config: \(String(describing: session.manager.protocolConfiguration))")
      return
    }
    DDLogDebug("OutlineVpn received status change for \(tunnelId): \(String(describing: session.status))")
    if isActiveSession(session) {
      Task {
        await setConnectVpnOnDemand(manager, true)
      }
    }
    self.vpnStatusObserver?(session.status, tunnelId)
  }
}

// Retrieves the application's tunnel provider manager from the VPN preferences.
private func getTunnelManager() async -> NETunnelProviderManager? {
  do {
    let managers: [NETunnelProviderManager] = try await NETunnelProviderManager.loadAllFromPreferences()
    guard managers.count > 0 else {
      DDLogDebug("OutlineVpn.getTunnelManager: No managers found")
      return nil
    }
    return managers.first
  } catch {
    DDLogError("Failed to get tunnel manager: \(error.localizedDescription)")
    return nil
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

private func stopSession(_ manager:NETunnelProviderManager) async {
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
