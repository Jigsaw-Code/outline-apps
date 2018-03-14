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

import CocoaLumberjack
import CocoaLumberjackSwift
import NetworkExtension
import Sentry

@objcMembers
class OutlinePlugin: CDVPlugin {

  private enum Action {
    static let start = "start"
    static let stop = "stop"
    static let onStatusChange = "onStatusChange"
  }

  public static let kAppQuitNotification = "outlinePluginAppQuitNotification"
  public static let kVpnConnectedNotification = "outlineVpnConnected"
  public static let kVpnDisconnectedNotification = "outlineVpnDisconnected"
  public static let kMaxBreadcrumbs: UInt = 100

  private var callbacks: [String: String]!
  private var connectivity: OutlineConnectivity?

#if os(macOS)
  // cordova-osx does not support URL interception. Until it does, we have version-controlled
  // AppDelegate.m (intercept) and Outline-Info.plist (register protocol) to handle ss:// URLs.
  private var urlHandler: CDVMacOsUrlHandler?
  private static let kPlatform = "macOS"
#else
  private static let kPlatform = "iOS"
#endif

  override func pluginInitialize() {
    OutlineSentryLogger.sharedInstance.initializeLogging()

    connectivity = OutlineConnectivity()
    callbacks = [String: String]()

    OutlineVpn.shared.onVpnStatusChange(onVpnStatusChange)

    #if os(macOS)
      self.urlHandler = CDVMacOsUrlHandler.init(self.webView)
      NotificationCenter.default.addObserver(
          self, selector: #selector(self.stopVpnOnAppQuit),
          name: NSNotification.Name(rawValue: OutlinePlugin.kAppQuitNotification),
          object: nil)
    #endif
  }

  /**
   Starts the VPN. This method is idempotent for a given connection.
   - Parameters:
    - command: CDVInvokedUrlCommand, where command.arguments
      - connectionId: string, ID of the connection
      - config: [String: Any], represents a server configuration
   */
  func start(_ command: CDVInvokedUrlCommand) {
    guard let connectionId = command.argument(at: 0) as? String else {
      return sendError("Missing connection ID", callbackId: command.callbackId,
                       errorCode: OutlineVpn.ErrorCode.illegalServerConfiguration)
    }
    DDLogInfo("\(Action.start) \(connectionId)")
    guard let config = command.argument(at: 1) as? [String: Any], containsExpectedKeys(config) else {
      return sendError("Invalid configuration", callbackId: command.callbackId,
                       errorCode: OutlineVpn.ErrorCode.illegalServerConfiguration)
    }
    let connection = OutlineConnection(id: connectionId, config: config)
    OutlineVpn.shared.start(connection) { errorCode in
      if errorCode == OutlineVpn.ErrorCode.noError {
        #if os(macOS)
          NotificationCenter.default.post(
            name: NSNotification.Name(rawValue: OutlinePlugin.kVpnConnectedNotification), object: nil)
        #endif
        self.sendSuccess(callbackId: command.callbackId)
      } else {
        self.sendError("Failed to start VPN", callbackId: command.callbackId,
                       errorCode: errorCode)
      }
    }
  }

  /**
   Stops the VPN. Sends an error if the given connection is not running.
   - Parameters:
    - command: CDVInvokedUrlCommand, where command.arguments
      - connectionId: string, ID of the connection
   */
  func stop(_ command: CDVInvokedUrlCommand) {
    guard let connectionId = command.argument(at: 0) as? String else {
      return sendError("Missing connection ID", callbackId: command.callbackId)
    }
    DDLogInfo("\(Action.stop) \(connectionId)")
    OutlineVpn.shared.stop(connectionId)
    sendSuccess(callbackId: command.callbackId)
    #if os(macOS)
      NotificationCenter.default.post(
        name: NSNotification.Name(rawValue: OutlinePlugin.kVpnDisconnectedNotification), object: nil)
    #endif
  }

  func isRunning(_ command: CDVInvokedUrlCommand) {
    guard let connectionId = command.argument(at: 0) as? String else {
      return sendError("Missing connection ID", callbackId: command.callbackId)
    }
    DDLogInfo("isRunning \(connectionId)")
    sendSuccess(OutlineVpn.shared.isActive(connectionId), callbackId: command.callbackId)
  }

  func isReachable(_ command: CDVInvokedUrlCommand) {
    guard let connectionId = command.argument(at: 0) as? String else {
      return sendError("Missing connection ID", callbackId: command.callbackId)
    }
    DDLogInfo("isReachable \(connectionId)")
    guard connectivity != nil else {
      return sendError("Cannot assess server reachability" , callbackId: command.callbackId)
    }
    guard let host = command.argument(at: 1) as? String else {
      return sendError("Missing host address" , callbackId: command.callbackId)
    }
    guard let port = command.argument(at: 2) as? UInt16 else {
      return sendError("Missing host port", callbackId: command.callbackId)
    }
    let connection = OutlineConnection(id: connectionId, config: ["host": host, "port": port])
    OutlineVpn.shared.isReachable(connection) { errorCode in
      self.sendSuccess(errorCode == OutlineVpn.ErrorCode.noError, callbackId: command.callbackId)
    }
  }

  func onStatusChange(_ command: CDVInvokedUrlCommand) {
    guard let connectionId = command.argument(at: 0) as? String else {
      return sendError("Missing connection ID", callbackId: command.callbackId)
    }
    DDLogInfo("\(Action.onStatusChange) \(connectionId)")
    setCallbackId(command.callbackId!, action: Action.onStatusChange, connectionId: connectionId)
  }

  // MARK: Error reporting

  func initializeErrorReporting(_ command: CDVInvokedUrlCommand) {
    DDLogInfo("initializeErrorReporting")
    guard let apiKey = command.argument(at: 0) as? String else {
      return sendError("Missing error reporting API key.", callbackId: command.callbackId)
    }
    do {
      Client.shared = try Client(dsn: apiKey)
      try Client.shared?.startCrashHandler()
      Client.shared?.breadcrumbs.maxBreadcrumbs = OutlinePlugin.kMaxBreadcrumbs;
      sendSuccess(true, callbackId: command.callbackId)
    } catch let error {
      sendError("Failed to init error reporting: \(error)", callbackId: command.callbackId)
    }
  }

  func reportEvents(_ command: CDVInvokedUrlCommand) {
    guard Client.shared != nil else {
      sendError("Failed to report events. Sentry not initialized.", callbackId: command.callbackId)
      return
    }
    let event = Event(level: .info)
    var uuid: String
    if let eventId = command.argument(at: 0) as? String {
      // Associate this event with the one reported from JS.
      event.tags = ["user_event_id": eventId]
      uuid = eventId
    } else {
      uuid = NSUUID().uuidString
    }
    event.message = "\(OutlinePlugin.kPlatform) report (\(uuid))"

    OutlineSentryLogger.sharedInstance.addVpnExtensionLogsToSentry()
    Client.shared?.send(event: event) { (error) in
      if error == nil {
        self.sendSuccess(true, callbackId: command.callbackId)
        Client.shared?.breadcrumbs.clear() // Breadcrumbs are persisted, clear on send success.
      } else {
        self.sendError("Failed to report event: \(String(describing: error))",
                       callbackId: command.callbackId)
      }
    }
  }

#if os(macOS)
  func quitApplication(_ command: CDVInvokedUrlCommand) {
    NSApplication.shared.terminate(self)
  }
#endif

  // MARK: Helpers

  @objc private func stopVpnOnAppQuit() {
    if let activeConnectionId = OutlineVpn.shared.activeConnectionId {
      OutlineVpn.shared.stop(activeConnectionId)
    }
  }

  // Receives NEVPNStatusDidChange notifications. Calls onConnectionStatusChange for the active
  // connection.
  func onVpnStatusChange(vpnStatus: NEVPNStatus, connectionId: String) {
    var connectionStatus: Int
    switch vpnStatus {
      case .connected:
        #if os(macOS)
          NotificationCenter.default.post(
            name: NSNotification.Name(rawValue: OutlinePlugin.kVpnConnectedNotification), object: nil)
        #endif
        connectionStatus = OutlineConnection.ConnectionStatus.connected.rawValue
      case .disconnected:
        #if os(macOS)
          NotificationCenter.default.post(
            name: NSNotification.Name(rawValue: OutlinePlugin.kVpnDisconnectedNotification), object: nil)
        #endif
        connectionStatus = OutlineConnection.ConnectionStatus.disconnected.rawValue
      case .reasserting:
        connectionStatus = OutlineConnection.ConnectionStatus.reconnecting.rawValue
      default:
        return;  // Do not report transient or invalid states.
    }
    DDLogDebug("Calling onStatusChange (\(connectionStatus)) for connection \(connectionId)")
    if let callbackId = getCallbackIdFor(action: Action.onStatusChange,
                                         connectionId: connectionId,
                                         keepCallback: true) {
      let result = CDVPluginResult(status: CDVCommandStatus_OK, messageAs: Int32(connectionStatus))
      send(pluginResult: result, callbackId: callbackId, keepCallback: true)
    }
  }

  // Returns whether |config| contains all the expected keys
  private func containsExpectedKeys(_ config: [String: Any]?) -> Bool {
    return config?["host"] != nil && config?["port"] != nil &&
        config?["password"] != nil && config?["method"] != nil
  }

  // MARK: Callback helpers

  private func sendSuccess(callbackId: String, keepCallback: Bool = false) {
    let result = CDVPluginResult(status: CDVCommandStatus_OK)
    send(pluginResult: result, callbackId: callbackId, keepCallback: keepCallback)
  }

  private func sendSuccess(_ operationResult: Bool, callbackId: String, keepCallback: Bool = false) {
    let result = CDVPluginResult(status: CDVCommandStatus_OK, messageAs: operationResult)
    send(pluginResult: result, callbackId: callbackId, keepCallback: keepCallback)
  }

  private func sendError(_ message: String, callbackId: String,
                         errorCode: OutlineVpn.ErrorCode = OutlineVpn.ErrorCode.undefined,
                         keepCallback: Bool = false) {
    DDLogError(message)
    let result = CDVPluginResult(status: CDVCommandStatus_ERROR,
                                 messageAs: Int32(errorCode.rawValue))
    send(pluginResult: result, callbackId: callbackId, keepCallback: keepCallback)
  }

  private func send(pluginResult: CDVPluginResult?, callbackId: String, keepCallback: Bool) {
    guard let result = pluginResult else {
      return DDLogWarn("Missing plugin result");
    }
    result.setKeepCallbackAs(keepCallback)
    self.commandDelegate?.send(result, callbackId: callbackId)
  }

  // Maps |action| and |connectionId| to |callbackId| in the callbacks dictionary.
  private func setCallbackId(_ callbackId: String, action: String, connectionId: String) {
    DDLogDebug("\(action):\(connectionId):\(callbackId)")
    callbacks["\(action):\(connectionId)"] = callbackId
  }

  // Retrieves the callback ID for |action| and |connectionId|. Unmaps the entry if |keepCallback|
  // is false.
  private func getCallbackIdFor(action: String, connectionId: String?,
                                keepCallback: Bool = false) -> String? {
    guard let connectionId = connectionId else {
      return nil
    }
    let key = "\(action):\(connectionId)"
    guard let callbackId = callbacks[key] else {
      DDLogWarn("Callback id not found for action \(action) and connection \(connectionId)")
      return nil
    }
    if (!keepCallback) {
      callbacks.removeValue(forKey: key)
    }
    return callbackId
  }
}
