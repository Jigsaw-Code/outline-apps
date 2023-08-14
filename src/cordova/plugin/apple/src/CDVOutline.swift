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

import OutlinePlugin
import OutlineTunnel

@objcMembers
class CDVOutline: CDVPlugin {
    private enum Action {
        static let onStatusChange = "onStatusChange"
    }

    private var callbacks: [String: String]!
    private var plugin: OutlinePlugin!

    override func pluginInitialize() {
        callbacks = [String: String]()
        plugin = OutlinePlugin()
        OutlineVpn.shared.onVpnStatusChange(onVpnStatusChange)
    }

    /**
     Starts the VPN. This method is idempotent for a given tunnel.
     - Parameter command: CDVInvokedUrlCommand, where command.arguments is (tunnelId, configJson)
     */
    func start(_ command: CDVInvokedUrlCommand) {
        let tunnelId = command.argument(at: 0) as? String
        let configJson = command.argument(at: 1) as? [String: Any]
        plugin.start(tunnelId, configJson,
                     onSuccess: { () in
                         self.sendSuccess(callbackId: command.callbackId)
                     },
                     onFailure: { (message: String, errorCode: OutlineVpn.ErrorCode) in
                         self.sendError(message, callbackId: command.callbackId, errorCode: errorCode)
                     })
    }

    /**
     Stops the VPN. Sends an error if the given tunnel is not running.
     - Parameter command: CDVInvokedUrlCommand, where command.arguments is (tunnelId)
     */
    func stop(_ command: CDVInvokedUrlCommand) {
        let tunnelId = command.argument(at: 0) as? String
        plugin.stop(tunnelId,
                    onSuccess: { () in
                        self.sendSuccess(callbackId: command.callbackId)
                    },
                    onFailure: { (message: String, errorCode: OutlineVpn.ErrorCode) in
                        self.sendError(message, callbackId: command.callbackId, errorCode: errorCode)
                    })
    }

    /**
     Checks whether the given tunnel is running.
     - Parameter command: CDVInvokedUrlCommand, where command.arguments is (tunnelId)
     */
    func isRunning(_ command: CDVInvokedUrlCommand) {
        let tunnelId = command.argument(at: 0) as? String
        plugin.isRunning(tunnelId,
                         onSuccess: { (operationResult: Bool) in
                             self.sendSuccess(operationResult, callbackId: command.callbackId)
                         },
                         onFailure: { (message: String, errorCode: OutlineVpn.ErrorCode) in
                             self.sendError(message, callbackId: command.callbackId, errorCode: errorCode)
                         })
    }

    /**
     Processes a VPN status change.
     - Parameter command: CDVInvokedUrlCommand, where command.arguments is (tunnelId)
     */
    func onStatusChange(_ command: CDVInvokedUrlCommand) {
        let tunnelId = command.argument(at: 0) as? String
        plugin.onStatusChange(tunnelId,
                              onSuccess: { () in
                                  self.setCallbackId(command.callbackId, action: Action.onStatusChange, tunnelId: tunnelId!)
                              },
                              onFailure: { (message: String, errorCode: OutlineVpn.ErrorCode) in
                                  self.sendError(message, callbackId: command.callbackId, errorCode: errorCode)
                              })
    }

    // MARK: Error reporting

    /**
     Initializes Sentry error reporting.
     - Parameter command: CDVInvokedUrlCommand, where command.arguments is (sentryDsn)
     */
    func initializeErrorReporting(_ command: CDVInvokedUrlCommand) {
        let sentryDsn = command.argument(at: 0) as? String
        plugin.initializeErrorReporting(sentryDsn,
                                        onSuccess: { (_: Bool) in
                                            self.sendSuccess(callbackId: command.callbackId)
                                        },
                                        onFailure: { (message: String, errorCode: OutlineVpn.ErrorCode) in
                                            self.sendError(message, callbackId: command.callbackId, errorCode: errorCode)
                                        })
    }

    /**
     Reports a given event.
     - Parameter command: CDVInvokedUrlCommand, where command.arguments is (eventId)
     */
    func reportEvents(_ command: CDVInvokedUrlCommand) {
        let eventId = command.argument(at: 0) as? String
        plugin.reportEvents(eventId,
                            onSuccess: { (_: Bool) in
                                self.sendSuccess(callbackId: command.callbackId)
                            },
                            onFailure: { (message: String, errorCode: OutlineVpn.ErrorCode) in
                                self.sendError(message, callbackId: command.callbackId, errorCode: errorCode)
                            })
    }

    #if os(macOS)
        /**
         Terminates the application.
         - Parameter command: CDVInvokedUrlCommand, unused.
         */
        func quitApplication(_: CDVInvokedUrlCommand) {
            NSApplication.shared.terminate(self)
        }
    #endif

    /**
     Receives NEVPNStatusDidChange notifications. Calls onTunnelStatusChange for the active tunnel.
     */
    func onVpnStatusChange(vpnStatus: NEVPNStatus, tunnelId: String) {
        plugin.processVpnStatusChange(vpnStatus,
                                      onSuccess: { (tunnelStatus: OutlineTunnel.TunnelStatus) in
                                          DDLogDebug("Calling onStatusChange (\(tunnelStatus)) for tunnel \(tunnelId)")
                                          guard let callbackId = self.getCallbackIdFor(action: Action.onStatusChange,
                                                                                       tunnelId: tunnelId,
                                                                                       keepCallback: true)
                                          else {
                                              return
                                          }
                                          let result = CDVPluginResult(status: CDVCommandStatus_OK, messageAs: Int32(tunnelStatus.rawValue))
                                          self.send(pluginResult: result, callbackId: callbackId, keepCallback: true)
                                      })
    }

    // MARK: Callback helpers

    // Maps |action| and |tunnelId| to |callbackId| in the callbacks dictionary.
    private func setCallbackId(_ callbackId: String, action: String, tunnelId: String) {
        DDLogDebug("\(action):\(tunnelId):\(callbackId)")
        callbacks["\(action):\(tunnelId)"] = callbackId
    }

    // Retrieves the callback ID for |action| and |tunnelId|. Unmaps the entry if |keepCallback|
    // is false.
    private func getCallbackIdFor(action: String, tunnelId: String?,
                                  keepCallback: Bool = false) -> String?
    {
        guard let tunnelId = tunnelId else {
            return nil
        }
        let key = "\(action):\(tunnelId)"
        guard let callbackId = callbacks[key] else {
            DDLogWarn("Callback id not found for action \(action) and tunnel \(tunnelId)")
            return nil
        }
        if !keepCallback {
            callbacks.removeValue(forKey: key)
        }
        return callbackId
    }

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
                           keepCallback: Bool = false)
    {
        DDLogError(message)
        let result = CDVPluginResult(status: CDVCommandStatus_ERROR,
                                     messageAs: Int32(errorCode.rawValue))
        send(pluginResult: result, callbackId: callbackId, keepCallback: keepCallback)
    }

    private func send(pluginResult: CDVPluginResult?, callbackId: String, keepCallback: Bool) {
        guard let result = pluginResult else {
            return DDLogWarn("Missing plugin result")
        }
        result.setKeepCallbackAs(keepCallback)
        commandDelegate?.send(result, callbackId: callbackId)
    }
}
