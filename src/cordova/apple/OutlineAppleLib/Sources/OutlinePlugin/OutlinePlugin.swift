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

import OutlineSentryLogger
import OutlineTunnel

public class OutlinePlugin: NSObject {

    public static let kMaxBreadcrumbs: UInt = 100

    private var sentryLogger: OutlineSentryLogger!

    #if os(macOS) || targetEnvironment(macCatalyst)
        private static let kPlatform = "macOS"
        private static let kAppGroup = "QT8Z3Q9V3A.org.outline.macos.client"
    #else
        private static let kPlatform = "iOS"
        private static let kAppGroup = "group.org.outline.ios.client"
    #endif

    override public init() {
        super.init()

        sentryLogger = OutlineSentryLogger(forAppGroup: OutlinePlugin.kAppGroup)

        #if os(macOS) || targetEnvironment(macCatalyst)
            NotificationCenter.default.addObserver(
                self, selector: #selector(stopVpnOnAppQuit),
                name: .kAppQuit,
                object: nil
            )
        #endif

        #if os(iOS)
            migrateLocalStorage()
        #endif
    }

    /**
     Starts the VPN. This method is idempotent for a given tunnel.
     - Parameter tunnelId: The identifiers of the tunnel.
     - Parameter configJson: Represents a server configuration
     - Parameter onSuccess: Success callback.
     - Parameter onFailure: Failure callback.
     */
    public func start(_ tunnelId: String?, _ configJson: [String: Any]?,
                      onSuccess success: @escaping () -> Void,
                      onFailure failure: @escaping (_ message: String, _ errorCode: OutlineVpn.ErrorCode) -> Void)
    {
        guard let tunnelId = tunnelId else {
            return failure("Missing tunnel ID",
                           OutlineVpn.ErrorCode.illegalServerConfiguration)
        }
        DDLogInfo("start \(tunnelId)")
        // TODO(fortuna): Move the config validation to the config parsing code in Go.
        guard let configJson = configJson, containsExpectedKeys(configJson) else {
            return failure("Invalid configuration",
                           OutlineVpn.ErrorCode.illegalServerConfiguration)
        }
        OutlineVpn.shared.start(tunnelId, configJson: configJson) { errorCode in
            if errorCode == OutlineVpn.ErrorCode.noError {
                #if os(macOS) || targetEnvironment(macCatalyst)
                    NotificationCenter.default.post(name: .kVpnConnected, object: nil)
                #endif
                success()
            } else {
                failure("Failed to start VPN", errorCode)
            }
        }
    }

    /**
     Stops the VPN. Sends an error if the given tunnel is not running.
     - Parameter tunnelId: The identifiers of the tunnel.
     - Parameter onSuccess: Success callback.
     - Parameter onFailure: Failure callback.
     */
    public func stop(_ tunnelId: String?,
                     onSuccess success: @escaping () -> Void,
                     onFailure failure: @escaping (_ message: String, _ errorCode: OutlineVpn.ErrorCode) -> Void)
    {
        guard let tunnelId = tunnelId else {
            return failure("Missing tunnel ID", OutlineVpn.ErrorCode.undefined)
        }
        DDLogInfo("stop \(tunnelId)")
        OutlineVpn.shared.stop(tunnelId)
        success()
        #if os(macOS) || targetEnvironment(macCatalyst)
            NotificationCenter.default.post(name: .kVpnDisconnected, object: nil)
        #endif
    }

    /**
     Checks if a tunnel is running.
     - Parameter tunnelId: The identifiers of the tunnel.
     - Parameter onSuccess: Success callback.
     - Parameter onFailure: Failure callback.
     */
    public func isRunning(_ tunnelId: String?,
                          onSuccess success: @escaping (_ operationResult: Bool) -> Void,
                          onFailure failure: @escaping (_ message: String, _ errorCode: OutlineVpn.ErrorCode) -> Void)
    {
        guard let tunnelId = tunnelId else {
            return failure("Missing tunnel ID", OutlineVpn.ErrorCode.undefined)
        }
        DDLogInfo("isRunning \(tunnelId)")
        success(OutlineVpn.shared.isActive(tunnelId))
    }

    /**
     Checks if a tunnel is running.
     - Parameter tunnelId: The identifiers of the tunnel.
     - Parameter onSuccess: Success callback.
     - Parameter onFailure: Failure callback.
     */
    public func onStatusChange(_ tunnelId: String?,
                               onSuccess success: @escaping () -> Void,
                               onFailure failure: @escaping (_ message: String, _ errorCode: OutlineVpn.ErrorCode) -> Void)
    {
        guard let tunnelId = tunnelId else {
            return failure("Missing tunnel ID", OutlineVpn.ErrorCode.undefined)
        }
        DDLogInfo("onStatusChange \(tunnelId)")
        success()
    }

    // MARK: Error reporting

    /**
     Initialize Sentry error reporting.
     - Parameter sentryDsn: Sentry API key to use.
     - Parameter onSuccess: Success callback.
     - Parameter onFailure: Failure callback.
     */
    public func initializeErrorReporting(_ sentryDsn: String?,
                                         onSuccess success: @escaping (_ operationResult: Bool) -> Void,
                                         onFailure failure: @escaping (_ message: String, _ errorCode: OutlineVpn.ErrorCode) -> Void)
    {
        DDLogInfo("initializeErrorReporting")
        guard sentryDsn != nil else {
            return failure("Missing error reporting API key.", OutlineVpn.ErrorCode.undefined)
        }
        SentrySDK.start { options in
            options.dsn = sentryDsn
            options.maxBreadcrumbs = UInt(OutlinePlugin.kMaxBreadcrumbs)
            // Remove device identifier, timezone, and memory stats.
            options.beforeSend = { event in
                event.context?["app"]?.removeValue(forKey: "device_app_hash")
                if var device = event.context?["device"] {
                    device.removeValue(forKey: "timezone")
                    device.removeValue(forKey: "memory_size")
                    device.removeValue(forKey: "free_memory")
                    device.removeValue(forKey: "usable_memory")
                    device.removeValue(forKey: "storage_size")
                    event.context?["device"] = device
                }
                return event
            }
        }
        success(true)
    }

    /**
     Report a given event ID to Sentry.
     - Parameter eventId: The identifier of the evnet to report on.
     - Parameter onSuccess: Success callback.
     - Parameter onFailure: Failure callback.
     */
    public func reportEvents(_ eventId: String?,
                             onSuccess success: @escaping (_ operationResult: Bool) -> Void,
                             onFailure _: @escaping (_ message: String, _ errorCode: OutlineVpn.ErrorCode) -> Void)
    {
        var uuid: String
        if eventId != nil {
            // Associate this event with the one reported from JS.
            SentrySDK.configureScope { scope in
                scope.setTag(value: eventId!, key: "user_event_id")
            }
            uuid = eventId!
        } else {
            uuid = NSUUID().uuidString
        }
        sentryLogger.addVpnExtensionLogsToSentry(maxBreadcrumbsToAdd: Int(OutlinePlugin.kMaxBreadcrumbs / 2))
        SentrySDK.capture(message: "\(OutlinePlugin.kPlatform) report (\(uuid))") { scope in
            scope.setLevel(.info)
        }
        success(true)
    }
    
    /**
     Receives NEVPNStatusDidChange notifications. Calls onTunnelStatusChange for the active tunnel.
     - Parameter vpnStatus: The status that corresponds to the change.
     - Parameter onSuccess: Success callback.
     */
    public func processVpnStatusChange(_ vpnStatus: NEVPNStatus,
                                       onSuccess success: @escaping (_ tunnelStatus: OutlineTunnel.TunnelStatus) -> Void) {
      var tunnelStatus: OutlineTunnel.TunnelStatus
      switch vpnStatus {
        case .connected:
  #if os(macOS) || targetEnvironment(macCatalyst)
            NotificationCenter.default.post(name: .kVpnConnected, object: nil)
  #endif
          tunnelStatus = OutlineTunnel.TunnelStatus.connected
        case .disconnected:
  #if os(macOS) || targetEnvironment(macCatalyst)
              NotificationCenter.default.post(name: .kVpnDisconnected, object: nil)
  #endif
          tunnelStatus = OutlineTunnel.TunnelStatus.disconnected
        case .reasserting:
          tunnelStatus = OutlineTunnel.TunnelStatus.reconnecting
        default:
          return;  // Do not report transient or invalid states.
      }
     success(tunnelStatus)
    }

    // MARK: Helpers

    @objc private func stopVpnOnAppQuit() {
        if let activeTunnelId = OutlineVpn.shared.activeTunnelId {
            OutlineVpn.shared.stop(activeTunnelId)
        }
    }

    // Returns whether |config| contains all the expected keys
    private func containsExpectedKeys(_ configJson: [String: Any]?) -> Bool {
        return configJson?["host"] != nil && configJson?["port"] != nil &&
            configJson?["password"] != nil && configJson?["method"] != nil
    }

    // Migrates local storage files from UIWebView to WKWebView.
    private func migrateLocalStorage() {
        // Local storage backing files have the following naming format: $scheme_$hostname_$port.localstorage
        // With UIWebView, the app used the file:// scheme with no hostname and any port.
        let kUIWebViewLocalStorageFilename = "file__0.localstorage"
        // With WKWebView, the app uses the app:// scheme with localhost as a hostname and any port.
        let kWKWebViewLocalStorageFilename = "app_localhost_0.localstorage"

        let fileManager = FileManager.default
        let appLibraryDir = fileManager.urls(for: .libraryDirectory, in: .userDomainMask)[0]

        let uiWebViewLocalStorageDir: URL
        #if targetEnvironment(macCatalyst)
            guard let bundleID = Bundle.main.bundleIdentifier else {
                return DDLogError("Unable to get bundleID for app.")
            }
            let appSupportDir = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            uiWebViewLocalStorageDir = appSupportDir.appendingPathComponent(bundleID)
        #else
            if fileManager.fileExists(atPath: appLibraryDir.appendingPathComponent(
                "WebKit/LocalStorage/\(kUIWebViewLocalStorageFilename)").relativePath)
            {
                uiWebViewLocalStorageDir = appLibraryDir.appendingPathComponent("WebKit/LocalStorage")
            } else {
                uiWebViewLocalStorageDir = appLibraryDir.appendingPathComponent("Caches")
            }
        #endif
        let uiWebViewLocalStorage = uiWebViewLocalStorageDir.appendingPathComponent(kUIWebViewLocalStorageFilename)
        if !fileManager.fileExists(atPath: uiWebViewLocalStorage.relativePath) {
            return DDLogInfo("Not migrating, UIWebView local storage files missing.")
        }

        let wkWebViewLocalStorageDir = appLibraryDir.appendingPathComponent("WebKit/WebsiteData/LocalStorage/")
        let wkWebViewLocalStorage = wkWebViewLocalStorageDir.appendingPathComponent(kWKWebViewLocalStorageFilename)
        // Only copy the local storage files if they don't exist for WKWebView.
        if fileManager.fileExists(atPath: wkWebViewLocalStorage.relativePath) {
            return DDLogInfo("Not migrating, WKWebView local storage files present.")
        }
        DDLogInfo("Migrating UIWebView local storage to WKWebView")

        // Create the WKWebView local storage directory; this is safe if the directory already exists.
        do {
            try fileManager.createDirectory(at: wkWebViewLocalStorageDir, withIntermediateDirectories: true)
        } catch {
            return DDLogError("Failed to create WKWebView local storage directory")
        }

        // Create a tmp directory and copy onto it the local storage files.
        guard let tmpDir = try? fileManager.url(for: .itemReplacementDirectory, in: .userDomainMask,
                                                appropriateFor: wkWebViewLocalStorage, create: true)
        else {
            return DDLogError("Failed to create tmp dir")
        }
        do {
            try fileManager.copyItem(at: uiWebViewLocalStorage,
                                     to: tmpDir.appendingPathComponent(wkWebViewLocalStorage.lastPathComponent))
            try fileManager.copyItem(at: URL(fileURLWithPath: "\(uiWebViewLocalStorage.relativePath)-shm"),
                                     to: tmpDir.appendingPathComponent("\(kWKWebViewLocalStorageFilename)-shm"))
            try fileManager.copyItem(at: URL(fileURLWithPath: "\(uiWebViewLocalStorage.relativePath)-wal"),
                                     to: tmpDir.appendingPathComponent("\(kWKWebViewLocalStorageFilename)-wal"))
        } catch {
            return DDLogError("Local storage migration failed.")
        }

        // Atomically move the tmp directory to the WKWebView local storage directory.
        guard let _ = try? fileManager.replaceItemAt(wkWebViewLocalStorageDir, withItemAt: tmpDir,
                                                     backupItemName: nil, options: .usingNewMetadataOnly)
        else {
            return DDLogError("Failed to copy tmp dir to WKWebView local storage dir")
        }

        DDLogInfo("Local storage migration succeeded")
    }
}
